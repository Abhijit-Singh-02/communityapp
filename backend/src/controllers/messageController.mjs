import mongoose from 'mongoose'
import conversationModel from '../models/conversationModel.mjs'
import messageModel from '../models/messageModel.mjs'
import userModel from '../models/userModel.mjs'
import { normalizePagination, validateObjectId } from '../utils/validate.mjs'
import uploadProfile from '../aws/uploadProfile.mjs'

const sortIds = (a, b) => (String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0)

const getOrCreateConversation = async (userId, otherUserId) => {
    const a = new mongoose.Types.ObjectId(userId)
    const b = new mongoose.Types.ObjectId(otherUserId)
    const ids = [a, b].sort(sortIds)
    const existing = await conversationModel.findOne({ participants: { $all: ids, $size: 2 } })
    if (existing) return existing
    return await conversationModel.create({
        participants: ids,
        lastReadAtByUser: {
            [String(userId)]: new Date(),
            [String(otherUserId)]: new Date(0),
        },
    })
}

/**
 * GET /conversations
 * Returns: list with other user + last message + unread count.
 */
const listConversations = async (req, res) => {
    try {
        const userId = req.user?.id
        if (!userId || !validateObjectId(userId)) return res.status(401).send({ message: 'Unauthorized' })
        const { limit } = normalizePagination(req.query)

        const convs = await conversationModel
            .find({ participants: new mongoose.Types.ObjectId(userId) })
            .sort({ lastMessageAt: -1, updatedAt: -1 })
            .limit(limit)
            .lean()

        const myIdStr = String(userId)

        const otherIds = convs
            .map((c) => c.participants.map(String).find((id) => id !== myIdStr))
            .filter(Boolean)

        const users = await userModel
            .find({ _id: { $in: otherIds } })
            .select('username profilePicture')
            .lean()
        const userMap = new Map(users.map((u) => [String(u._id), u]))

        const items = await Promise.all(
            convs.map(async (c) => {
                const otherId = c.participants.map(String).find((id) => id !== myIdStr)
                const lastReadAt = c.lastReadAtByUser?.[myIdStr] || c.lastReadAtByUser?.get?.(myIdStr) || null
                const unread = await messageModel.countDocuments({
                    conversationId: c._id,
                    status: 'sent',
                    senderId: { $ne: new mongoose.Types.ObjectId(userId) },
                    ...(lastReadAt ? { createdAt: { $gt: lastReadAt } } : {}),
                })

                return {
                    _id: c._id,
                    otherUser: otherId ? userMap.get(String(otherId)) : null,
                    lastMessageText: c.lastMessageText || '',
                    lastMessageAt: c.lastMessageAt,
                    unreadCount: unread,
                }
            })
        )

        return res.status(200).send({ message: 'Conversations', conversations: items })
    } catch (error) {
        return res.status(500).send({ message: 'Internal server error' })
    }
}

/**
 * POST /conversations
 * body: { otherUserId }
 */
const createConversation = async (req, res) => {
    try {
        const userId = req.user?.id
        const { otherUserId } = req.body || {}
        if (!userId || !validateObjectId(userId) || !validateObjectId(otherUserId)) {
            return res.status(400).send({ message: 'Invalid request' })
        }
        if (String(userId) === String(otherUserId)) {
            return res.status(400).send({ message: 'Invalid request' })
        }

        const other = await userModel.findById(otherUserId).select('_id username profilePicture').lean()
        if (!other) return res.status(404).send({ message: 'User not found' })

        const conv = await getOrCreateConversation(userId, otherUserId)
        return res.status(201).send({
            message: 'Conversation ready',
            conversation: { _id: conv._id, otherUser: other },
        })
    } catch (error) {
        return res.status(500).send({ message: 'Internal server error' })
    }
}

/**
 * GET /conversations/:conversationId/messages
 */
const listMessages = async (req, res) => {
    try {
        const userId = req.user?.id
        const { conversationId } = req.params
        if (!userId || !validateObjectId(userId) || !validateObjectId(conversationId)) {
            return res.status(400).send({ message: 'Invalid request' })
        }

        const conv = await conversationModel.findById(conversationId).lean()
        if (!conv) return res.status(404).send({ message: 'Conversation not found' })
        const isMember = conv.participants.map(String).includes(String(userId))
        if (!isMember) return res.status(403).send({ message: 'Not allowed' })

        const { page, limit, skip } = normalizePagination(req.query)
        const msgs = await messageModel
            .find({ conversationId, status: 'sent' })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean()

        return res.status(200).send({ message: 'Messages', page, limit, messages: msgs.reverse() })
    } catch (error) {
        return res.status(500).send({ message: 'Internal server error' })
    }
}

/**
 * POST /conversations/:conversationId/read
 */
const markConversationRead = async (req, res) => {
    try {
        const userId = req.user?.id
        const { conversationId } = req.params
        if (!userId || !validateObjectId(userId) || !validateObjectId(conversationId)) {
            return res.status(400).send({ message: 'Invalid request' })
        }
        const conv = await conversationModel.findById(conversationId)
        if (!conv) return res.status(404).send({ message: 'Conversation not found' })
        const isMember = conv.participants.map(String).includes(String(userId))
        if (!isMember) return res.status(403).send({ message: 'Not allowed' })

        conv.lastReadAtByUser.set(String(userId), new Date())
        await conv.save()
        return res.status(200).send({ message: 'OK' })
    } catch (error) {
        return res.status(500).send({ message: 'Internal server error' })
    }
}

const updateConversationLastMessage = async (conversationId) => {
    const last = await messageModel
        .findOne({ conversationId, status: 'sent' })
        .sort({ createdAt: -1 })
        .lean()
    if (!last) {
        await conversationModel.updateOne(
            { _id: conversationId },
            { $set: { lastMessageText: '', lastMessageAt: null, lastMessageSenderId: null } }
        )
        return
    }
    await conversationModel.updateOne(
        { _id: conversationId },
        {
            $set: {
                lastMessageText: (last.text || '').slice(0, 240),
                lastMessageAt: last.createdAt,
                lastMessageSenderId: last.senderId,
            },
        }
    )
}

/**
 * PATCH /messages/:messageId
 * body: { text }
 */
const editMessage = async (req, res) => {
    try {
        const userId = req.user?.id
        const { messageId } = req.params
        const text = typeof req.body?.text === 'string' ? req.body.text.trim() : ''
        if (!userId || !validateObjectId(userId) || !validateObjectId(messageId)) {
            return res.status(400).send({ message: 'Invalid request' })
        }
        if (!text) return res.status(400).send({ message: 'Message text is required' })
        if (text.length > 4000) return res.status(400).send({ message: 'Message is too long' })

        const msg = await messageModel.findById(messageId)
        if (!msg || msg.status !== 'sent') return res.status(404).send({ message: 'Message not found' })
        if (String(msg.senderId) !== String(userId)) return res.status(403).send({ message: 'Not allowed' })

        msg.text = text
        msg.isEdited = true
        msg.editedAt = new Date()
        await msg.save()

        await updateConversationLastMessage(msg.conversationId)
        return res.status(200).send({
            message: 'Message edited',
            messageDoc: {
                _id: msg._id,
                conversationId: msg.conversationId,
                senderId: msg.senderId,
                text: msg.text,
                createdAt: msg.createdAt,
                isEdited: msg.isEdited,
                editedAt: msg.editedAt,
            },
        })
    } catch (error) {
        return res.status(500).send({ message: 'Internal server error' })
    }
}

/**
 * DELETE /messages/:messageId (soft delete)
 */
const deleteMessage = async (req, res) => {
    try {
        const userId = req.user?.id
        const { messageId } = req.params
        if (!userId || !validateObjectId(userId) || !validateObjectId(messageId)) {
            return res.status(400).send({ message: 'Invalid request' })
        }
        const msg = await messageModel.findById(messageId)
        if (!msg || msg.status !== 'sent') return res.status(404).send({ message: 'Message not found' })
        if (String(msg.senderId) !== String(userId)) return res.status(403).send({ message: 'Not allowed' })

        msg.status = 'deleted'
        msg.text = '[deleted]'
        await msg.save()

        await updateConversationLastMessage(msg.conversationId)
        return res.status(200).send({ message: 'Message deleted', messageId: String(msg._id) })
    } catch (error) {
        return res.status(500).send({ message: 'Internal server error' })
    }
}

/**
 * POST /messages/upload
 * Returns mediaUrl
 */
const uploadMessageMedia = async (req, res) => {
    try {
        const userId = req.user?.id
        if (!userId) return res.status(401).send({ message: 'Unauthorized' })
        if (!req.file) return res.status(400).send({ message: 'No file uploaded' })
        const mediaUrl = await uploadProfile(req.file)
        return res.status(200).send({ mediaUrl })
    } catch (error) {
        return res.status(500).send({ message: 'Internal server error' })
    }
}

export {
    listConversations,
    createConversation,
    listMessages,
    markConversationRead,
    editMessage,
    deleteMessage,
    uploadMessageMedia,
    getOrCreateConversation,
}

