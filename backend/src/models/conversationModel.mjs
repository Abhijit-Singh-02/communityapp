import mongoose from 'mongoose'

const conversationSchema = new mongoose.Schema(
    {
        participants: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
                required: true,
            },
        ],
        /** last message preview (for inbox list) */
        lastMessageText: { type: String, default: '' },
        lastMessageAt: { type: Date, default: null, index: true },
        lastMessageSenderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        /** per-user last read timestamps */
        lastReadAtByUser: {
            type: Map,
            of: Date,
            default: {},
        },
    },
    { timestamps: true }
)

conversationSchema.index({ participants: 1 })
conversationSchema.index({ lastMessageAt: -1 })

const conversationModel = mongoose.model('Conversation', conversationSchema)
export default conversationModel

