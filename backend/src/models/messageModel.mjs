import mongoose from 'mongoose'

const messageSchema = new mongoose.Schema(
    {
        conversationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Conversation',
            required: true,
            index: true,
        },
        senderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        text: {
            type: String,
            default: '',
            trim: true,
            maxlength: 4000,
        },
        mediaUrl: { type: String, default: null },
        mediaType: { type: String, default: null },
        isEdited: { type: Boolean, default: false, index: true },
        editedAt: { type: Date, default: null },
        status: {
            type: String,
            enum: ['sent', 'deleted'],
            default: 'sent',
            index: true,
        },
    },
    { timestamps: true }
)

messageSchema.index({ conversationId: 1, createdAt: -1 })

const messageModel = mongoose.model('Message', messageSchema)
export default messageModel

