import express from 'express'
const router = express.Router()
import { authenticate } from './auth/authentication.mjs'
import { createUser, loginUser, getProfile, updateProfile } from './controllers/userController.mjs'
import multer from 'multer'

// Store uploads in memory so we can upload to S3 using `file.buffer`.
const upload = multer({ storage: multer.memoryStorage() })
router.post('/signup', createUser)
router.post('/login', loginUser)
router.get('/profile', authenticate, getProfile)
router.put('/profile', authenticate, upload.single('profilePicture'), updateProfile)
export default router