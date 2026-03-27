import mongoose from "mongoose";
import postModel from "../models/postModel.mjs";
import userModel from "../models/userModel.mjs";
import commentModel from "../models/commentModel.mjs";
import uploadProfile from "../aws/uploadProfile.mjs";
import {
    normalizePagination,
    validateObjectId,
    validatePostPayload,
    validateJobPayload,
} from "../utils/validate.mjs";

const createPost = async (req, res) => {
    try {
        const userId = req.user?.id
        if (!userId || !validateObjectId(userId)) {
            return res.status(401).send({ message: 'Unauthorized' })
        }

        let mediaUrl = ''
        let inferredMediaType = ''
        if (req.file) {
            mediaUrl = await uploadProfile(req.file)
            if (req.file.mimetype?.startsWith('image/')) inferredMediaType = 'image'
            else if (req.file.mimetype?.startsWith('video/')) inferredMediaType = 'video'
        }

        const payload = {
            ...req.body,
            media: req.body?.media || mediaUrl,
            mediaType: req.body?.mediaType || inferredMediaType || 'text',
        }

        const postTypeRaw = typeof req.body?.postType === 'string' ? req.body.postType : ''
        const postType = postTypeRaw && ['post', 'job'].includes(postTypeRaw) ? postTypeRaw : 'post'

        const validation = postType === 'job' ? validateJobPayload(payload) : validatePostPayload(payload)
        if (!validation.valid) return res.status(400).send({ message: validation.message })

        const user = await userModel.findById(userId).select('_id')
        if (!user) {
            return res.status(404).send({ message: 'User not found' })
        }

        let post
        if (postType === 'job') {
            const { title, company, location, employmentType, content } = validation.data
            post = await postModel.create({
                userId,
                postType: 'job',
                content,
                media: '',
                mediaType: 'text',
                visibility: 'public',
                location,
                hashtags: [],
                mentions: [],
                job: { title, company, location, employmentType },
            })
        } else {
            const { content, media, mediaType, visibility, location, hashtags, mentions } = validation.data
            post = await postModel.create({
                userId,
                postType: 'post',
                content,
                media,
                mediaType,
                visibility,
                location,
                hashtags,
                mentions,
            })
        }

        return res.status(201).send({ message: 'Post created successfully', post })
    } catch (error) {
        return res.status(500).send({ message: 'Internal server error' })
    }
}

const getPosts = async (req, res) => {
    try {
        const { page, limit, skip } = normalizePagination(req.query)
        const posts = await postModel
            .find({ status: 'active' })
            .sort({ createdAt: -1 })
            .populate('userId', 'username profilePicture')
            .skip(skip)
            .limit(limit)

        return res.status(200).send({
            message: 'Posts fetched successfully',
            page,
            limit,
            count: posts.length,
            posts,
        })
    } catch (error) {
        return res.status(500).send({ message: 'Internal server error' })
    }
}

const getJobs = async (req, res) => {
    try {
        const { page, limit, skip } = normalizePagination(req.query)
        const filter = { status: 'active', postType: 'job' }
        const [jobs, total] = await Promise.all([
            postModel
                .find(filter)
                .sort({ createdAt: -1 })
                .populate('userId', 'username profilePicture email')
                .skip(skip)
                .limit(limit),
            postModel.countDocuments(filter),
        ])

        return res.status(200).send({ message: 'Jobs fetched successfully', page, limit, total, jobs })
    } catch (error) {
        return res.status(500).send({ message: 'Internal server error' })
    }
}
const getPostsByUserId = async (req, res) => {
    try {
        const userId = req.params.userId
        const posts = await postModel
        .find({ status: 'active', userId: userId })
        .sort({ createdAt: -1 })
        .populate('userId', 'username profilePicture')
        return res.status(200).send({ message: 'Posts fetched successfully', posts })
    } catch (error) {
        return res.status(500).send({ message: 'Internal server error' })
    }
}

const toggleLikePost = async (req, res) => {
    try {
        const userId = req.user?.id
        const { postId } = req.params
        if (!userId || !validateObjectId(userId) || !validateObjectId(postId)) {
            return res.status(400).send({ message: 'Invalid request' })
        }
        const post = await postModel.findOne({ _id: postId, status: 'active' })
        if (!post) {
            return res.status(404).send({ message: 'Post not found' })
        }
        const uid = new mongoose.Types.ObjectId(userId)
        const likedBy = post.likedBy || []
        const idx = likedBy.findIndex((id) => id.equals(uid))
        if (idx >= 0) {
            likedBy.splice(idx, 1)
            post.likes = Math.max(0, (post.likes || 0) - 1)
        } else {
            likedBy.push(uid)
            post.likes = (post.likes || 0) + 1
        }
        post.likedBy = likedBy
        await post.save()
        const updated = await postModel.findById(post._id).populate('userId', 'username profilePicture')
        return res.status(200).send({ message: 'Like updated', post: updated })
    } catch (error) {
        return res.status(500).send({ message: 'Internal server error' })
    }
}

/**
 * DELETE /posts/:postId — permanently removes post (owner only) and all its comments.
 */
const deletePost = async (req, res) => {
    try {
        const rawUserId = req.user?.id ?? req.user?._id
        const userId = rawUserId != null ? String(rawUserId) : ""
        const { postId } = req.params
        if (!userId || !validateObjectId(userId) || !validateObjectId(postId)) {
            return res.status(400).send({ message: "Invalid request" })
        }

        const post = await postModel.findOne({ _id: postId, status: "active" })
        if (!post) {
            return res.status(404).send({ message: "Post not found" })
        }
        if (String(post.userId) !== userId) {
            return res.status(403).send({ message: "Not allowed to delete this post" })
        }

        await commentModel.deleteMany({ postId: post._id })
        await postModel.deleteOne({ _id: post._id })

        return res.status(200).send({ message: "Post deleted permanently" })
    } catch (error) {
        return res.status(500).send({ message: "Internal server error" })
    }
}

const sharePost = async (req, res) => {
    try {
        const { postId } = req.params
        if (!validateObjectId(postId)) {
            return res.status(400).send({ message: 'Invalid post id' })
        }
        const post = await postModel.findOneAndUpdate(
            { _id: postId, status: 'active' },
            { $inc: { sharesCount: 1 } },
            { new: true }
        ).populate('userId', 'username profilePicture')
        if (!post) {
            return res.status(404).send({ message: 'Post not found' })
        }
        return res.status(200).send({ message: 'Share recorded', post })
    } catch (error) {
        return res.status(500).send({ message: 'Internal server error' })
    }
}
const getReels = async (req, res) => {
    try {
        const { page, limit, skip } = normalizePagination(req.query)
        const reels = await postModel.find({ status: 'active', mediaType: 'video', visibility: 'public' })
        .sort({ createdAt: -1 })
        .populate('userId', 'username profilePicture')
        .skip(skip)
        .limit(limit)
        return res.status(200).send({ message: 'Reels fetched successfully', page, limit, count: reels.length, reels })
    } catch (error) {
        return res.status(500).send({ message: 'Internal server error' })
    }
}
export { createPost, getPosts, getJobs, getPostsByUserId, toggleLikePost, sharePost, deletePost, getReels }
