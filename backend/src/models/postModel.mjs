import mongoose from 'mongoose'
const postSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    postType: {
        type: String,
        default: 'post',
        enum: ['post', 'job'],
        index: true,
    },
    content: {
        type: String,
        default: '',
        trim: true,
        maxlength: 8000,
    },
    // Kept as a string URL for compatibility with current frontend.
    media: {
        type: String,
        default: '',
    },
    mediaType: {
        type: String,
        default: '',
        enum: ['', 'image', 'video', 'text', 'carousel'],
    },
    visibility: {
        type: String,
        default: 'public',
        enum: ['public', 'connections', 'private'],
        index: true,
    },
    location: {
        type: String,
        default: '',
        trim: true,
    },
    hashtags: {
        type: [String],
        default: [],
    },
    mentions: {
        type: [String],
        default: [],
    },
    likes: {
        type: Number,
        default: 0,
    },
    /** Users who liked this post (for toggle + isLiked on client). */
    likedBy: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    }],
    /** Denormalized count; source of truth is Comment collection. */
    commentsCount: {
        type: Number,
        default: 0,
    },
    sharesCount: {
        type: Number,
        default: 0,
    },
    isEdited: {
        type: Boolean,
        default: false,
    },
    status: {
        type: String,
        default: 'active',
        enum: ['active', 'archived', 'deleted'],
    },
    job: {
        title: { type: String, default: '', trim: true, maxlength: 140 },
        company: { type: String, default: '', trim: true, maxlength: 140 },
        location: { type: String, default: '', trim: true, maxlength: 140 },
        employmentType: { type: String, default: '', trim: true, maxlength: 40 },
    },
}, { timestamps: true })

postSchema.index({ userId: 1, createdAt: -1 })
postSchema.index({ createdAt: -1 })
postSchema.index({ postType: 1, createdAt: -1 })

const postModel = mongoose.model('Post', postSchema)
export default postModel