import express from 'express'
const router = express.Router()
import { authenticate } from './auth/authentication.mjs'
import {
    createUser,
    loginUser,
    getProfile,
    updateProfile,
    followUser,
    unfollowUser,
    listUsers,
    getNotifications,
    markNotificationsSeen,
    getPublicUser,
    getUserFollowers,
    getUserFollowing,
    forgotPassword,
    resetPassword,
} from './controllers/userController.mjs'
import { createPost, getPosts, getJobs, getPostsByUserId, toggleLikePost, sharePost, deletePost, getReels } from './controllers/postController.mjs'
import {
    getCommentsByPost,
    getRepliesToComment,
    createComment,
    deleteComment,
    toggleLikeComment,
} from './controllers/commentController.mjs'
import {
    listConversations,
    createConversation,
    listMessages,
    markConversationRead,
    editMessage,
    deleteMessage,
    uploadMessageMedia,
} from './controllers/messageController.mjs'
import multer from 'multer'

// Store uploads in memory so we can upload to S3 using `file.buffer`.
const upload = multer({ storage: multer.memoryStorage() })
router.post('/signup', createUser)
router.post('/login', loginUser)
router.post('/password/forgot', forgotPassword)
router.post('/password/reset', resetPassword)
router.get('/profile', authenticate, getProfile)
router.put('/profile', authenticate, upload.fields([{ name: 'profilePicture', maxCount: 1 }, { name: 'coverImage', maxCount: 1 }]), updateProfile)
router.post('/unfollow', authenticate, unfollowUser)
router.get('/notifications', authenticate, getNotifications)
router.post('/notifications/seen', authenticate, markNotificationsSeen)
router.get('/users', authenticate, listUsers)
router.get('/users/:userId/followers', authenticate, getUserFollowers)
router.get('/users/:userId/following', authenticate, getUserFollowing)
router.get('/users/:userId', authenticate, getPublicUser)
router.post('/posts', authenticate, upload.single('mediaFile'), createPost)
router.delete('/posts/:postId', authenticate, deletePost)
router.post('/posts/:postId/like', authenticate, toggleLikePost)
router.post('/posts/:postId/share', authenticate, sharePost)
router.get('/posts/:postId/comments', authenticate, getCommentsByPost)
router.get('/posts/:postId/comments/:commentId/replies', authenticate, getRepliesToComment)
router.post('/posts/:postId/comments', authenticate, createComment)
router.get('/jobs', authenticate, getJobs)
router.get('/posts', authenticate, getPosts)
router.get('/posts/:userId', authenticate, getPostsByUserId)
router.delete('/comments/:commentId', authenticate, deleteComment)
router.post('/comments/:commentId/like', authenticate, toggleLikeComment)
router.post('/follow', authenticate, followUser)
router.get('/reels', authenticate, getReels)
router.get('/conversations', authenticate, listConversations)
router.post('/conversations', authenticate, createConversation)
router.get('/conversations/:conversationId/messages', authenticate, listMessages)
router.post('/conversations/:conversationId/read', authenticate, markConversationRead)
router.post('/messages/upload', authenticate, upload.single('mediaFile'), uploadMessageMedia)
router.patch('/messages/:messageId', authenticate, editMessage)
router.delete('/messages/:messageId', authenticate, deleteMessage)
export default router