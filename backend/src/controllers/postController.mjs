import postModel from "../models/postModel.mjs";
import userModel from "../models/userModel.mjs";
import uploadProfile from "../aws/uploadProfile.mjs";
import {
    normalizePagination,
    validateObjectId,
    validatePostPayload,
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

        const validation = validatePostPayload(payload)
        if (!validation.valid) {
            return res.status(400).send({ message: validation.message })
        }

        const user = await userModel.findById(userId).select('_id')
        if (!user) {
            return res.status(404).send({ message: 'User not found' })
        }

        const { content, media, mediaType, visibility, location, hashtags, mentions } = validation.data
        const post = await postModel.create({
            userId,
            content,
            media,
            mediaType,
            visibility,
            location,
            hashtags,
            mentions,
        })

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

export { createPost, getPosts }
