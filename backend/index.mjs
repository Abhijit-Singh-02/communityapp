import express from 'express'
import mongoose from 'mongoose'
import cors from 'cors'
import { PORT, MONGO_URI } from './config.mjs'
import routes from './src/routes.mjs'
import http from 'http'
import { Server as SocketIOServer } from 'socket.io'
import jwt from 'jsonwebtoken'
import { JWT_SECRET } from './config.mjs'
import { validateObjectId } from './src/utils/validate.mjs'
import conversationModel from './src/models/conversationModel.mjs'
import messageModel from './src/models/messageModel.mjs'
import { getOrCreateConversation } from './src/controllers/messageController.mjs'
const app = express()
app.use(cors({ exposedHeaders: ['authorization'] }))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
mongoose.connect(MONGO_URI).then(() => {
    console.log('Connected to MongoDB')
}).catch((err) => {
    console.log(err)
})
app.use('/', routes);

const server = http.createServer(app)
const io = new SocketIOServer(server, {
    cors: {
        origin: true,
        credentials: true,
    },
})

io.use((socket, next) => {
    try {
        const token =
            socket.handshake.auth?.token ||
            (typeof socket.handshake.headers?.authorization === 'string'
                ? socket.handshake.headers.authorization.split(' ')[1]
                : null)
        if (!token) return next(new Error('Unauthorized'))
        const decoded = jwt.verify(token, JWT_SECRET)
        const userId = decoded?.id
        if (!userId || !validateObjectId(userId)) return next(new Error('Unauthorized'))
        socket.userId = String(userId)
        next()
    } catch (e) {
        next(new Error('Unauthorized'))
    }
})

io.on('connection', (socket) => {
    const userRoom = `user:${socket.userId}`
    socket.join(userRoom)

    socket.on('join_conversation', async ({ conversationId }) => {
        if (!conversationId || !validateObjectId(conversationId)) return
        const conv = await conversationModel.findById(conversationId).select('participants').lean()
        if (!conv) return
        if (!conv.participants.map(String).includes(String(socket.userId))) return
        socket.join(`conv:${conversationId}`)
    })

    socket.on('typing', ({ conversationId, isTyping }) => {
        if (!conversationId) return
        socket.to(`conv:${conversationId}`).emit('typing', {
            conversationId,
            userId: socket.userId,
            isTyping: !!isTyping,
        })
    })

    socket.on('send_message', async ({ conversationId, otherUserId, text, mediaUrl, mediaType }) => {
        try {
            const trimmed = typeof text === 'string' ? text.trim() : ''
            if (!trimmed && !mediaUrl) return

            let convId = conversationId
            let conv
            if (convId && validateObjectId(convId)) {
                conv = await conversationModel.findById(convId)
                if (!conv) return
                if (!conv.participants.map(String).includes(String(socket.userId))) return
            } else {
                if (!otherUserId || !validateObjectId(otherUserId)) return
                conv = await getOrCreateConversation(socket.userId, otherUserId)
                convId = String(conv._id)
            }

            const msg = await messageModel.create({
                conversationId: conv._id,
                senderId: socket.userId,
                text: trimmed,
                mediaUrl: mediaUrl || null,
                mediaType: mediaType || null,
            })

            let msgDesc = trimmed.slice(0, 240)
            if (!msgDesc && mediaUrl) {
                msgDesc = String(mediaType).includes('video') ? '[Video]' : '[Image]'
            }

            conv.lastMessageText = msgDesc
            conv.lastMessageAt = msg.createdAt
            conv.lastMessageSenderId = msg.senderId
            await conv.save()

            const payload = {
                _id: msg._id,
                conversationId: convId,
                senderId: String(msg.senderId),
                text: msg.text,
                mediaUrl: msg.mediaUrl || null,
                mediaType: msg.mediaType || null,
                createdAt: msg.createdAt,
            }

            // emit to conversation room and user rooms
            io.to(`conv:${convId}`).emit('message_new', payload)
            conv.participants.map(String).forEach((pid) => io.to(`user:${pid}`).emit('inbox_updated', { conversationId: convId }))
        } catch {
            /* ignore */
        }
    })

    socket.on('edit_message', async ({ messageId, text }) => {
        try {
            const trimmed = typeof text === 'string' ? text.trim() : ''
            if (!messageId || !validateObjectId(messageId) || !trimmed) return
            if (trimmed.length > 4000) return

            const msg = await messageModel.findById(messageId)
            if (!msg || msg.status !== 'sent') return
            if (String(msg.senderId) !== String(socket.userId)) return

            msg.text = trimmed
            msg.isEdited = true
            msg.editedAt = new Date()
            await msg.save()

            const conv = await conversationModel.findById(msg.conversationId)
            if (!conv) return
            // update last message preview if needed
            if (String(conv.lastMessageAt) === String(msg.createdAt) && String(conv.lastMessageSenderId) === String(msg.senderId)) {
                conv.lastMessageText = trimmed.slice(0, 240)
                await conv.save()
            } else if (String(conv.lastMessageSenderId) === String(msg.senderId) && conv.lastMessageText) {
                // best-effort: if last message is likely this message, update preview
                if (String(conv.lastMessageAt) === String(msg.createdAt)) {
                    conv.lastMessageText = trimmed.slice(0, 240)
                    await conv.save()
                }
            }

            const payload = {
                messageId: String(msg._id),
                conversationId: String(msg.conversationId),
                text: msg.text,
                isEdited: true,
                editedAt: msg.editedAt,
            }
            io.to(`conv:${payload.conversationId}`).emit('message_edited', payload)
            conv.participants.map(String).forEach((pid) => io.to(`user:${pid}`).emit('inbox_updated', { conversationId: payload.conversationId }))
        } catch {
            /* ignore */
        }
    })

    socket.on('delete_message', async ({ messageId }) => {
        try {
            if (!messageId || !validateObjectId(messageId)) return
            const msg = await messageModel.findById(messageId)
            if (!msg || msg.status !== 'sent') return
            if (String(msg.senderId) !== String(socket.userId)) return

            msg.status = 'deleted'
            msg.text = '[deleted]'
            await msg.save()

            const conv = await conversationModel.findById(msg.conversationId)
            if (!conv) return

            // If this was the last message, recompute last message preview
            const last = await messageModel
                .findOne({ conversationId: conv._id, status: 'sent' })
                .sort({ createdAt: -1 })
                .lean()
            if (!last) {
                conv.lastMessageText = ''
                conv.lastMessageAt = null
                conv.lastMessageSenderId = null
            } else {
                conv.lastMessageText = (last.text || '').slice(0, 240)
                conv.lastMessageAt = last.createdAt
                conv.lastMessageSenderId = last.senderId
            }
            await conv.save()

            const payload = { messageId: String(msg._id), conversationId: String(msg.conversationId) }
            io.to(`conv:${payload.conversationId}`).emit('message_deleted', payload)
            conv.participants.map(String).forEach((pid) => io.to(`user:${pid}`).emit('inbox_updated', { conversationId: payload.conversationId }))
        } catch {
            /* ignore */
        }
    })

    socket.on('read', async ({ conversationId }) => {
        try {
            if (!conversationId || !validateObjectId(conversationId)) return
            const conv = await conversationModel.findById(conversationId)
            if (!conv) return
            if (!conv.participants.map(String).includes(String(socket.userId))) return
            conv.lastReadAtByUser.set(String(socket.userId), new Date())
            await conv.save()
            socket.to(`conv:${conversationId}`).emit('read', { conversationId, userId: socket.userId })
            conv.participants.map(String).forEach((pid) => io.to(`user:${pid}`).emit('inbox_updated', { conversationId }))
        } catch {
            /* ignore */
        }
    })
})

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`)
})