import mongoose from 'mongoose'
import userModel from '../models/userModel.mjs'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { JWT_SECRET } from '../../config.mjs'
import uploadProfile from '../aws/uploadProfile.mjs'
import { validateObjectId, normalizePagination } from '../utils/validate.mjs'
import postModel from '../models/postModel.mjs'
import crypto from 'crypto'

const idEquals = (a, b) => String(a) === String(b)

const listHasId = (list, id) => Array.isArray(list) && list.some((x) => idEquals(x, id))

const safeUser = (doc) => {
    if (!doc) return null
    const o = doc.toObject ? doc.toObject() : doc
    delete o.password
    return o
}
const createUser = async (req, res) => {
    try {
        const { username, email, password, phoneNumber } = req.body
        if(!username || !email || !password || !phoneNumber) {
            return res.status(400).send({ message: 'All fields are required' })
        }
        const existingUser = await userModel.findOne({ email })
        if(existingUser) {
            return res.status(400).send({ message: 'User already exists' })
        }
        const existingUserByUsername = await userModel.findOne({ username })
        if(existingUserByUsername) {
            return res.status(400).send({ message: 'Username already exists' })
        }
        const existingUserByPhoneNumber = await userModel.findOne({ phoneNumber })
        if (existingUserByPhoneNumber) {
            return res.status(400).send({ message: 'Phone number already exists' })
        }
        const hashedPassword = await bcrypt.hash(password, 10)
        const user = await userModel.create({ username, email, password: hashedPassword, phoneNumber });
        res.status(201).send({ message: 'User created successfully', user });
    } catch (error) {
        if(error.message.includes('duplicate')) {
            return res.status(400).send({ message: 'User already exists' })
        }else if(error.message.includes('validation')) {
            return res.status(400).send({ message: 'Validation error' })
        }else{
            return res.status(500).send({ message: 'Internal server error' });
        }
    }
};
const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body
        if(!email || !password) {
            return res.status(400).send({ message: 'All fields are required' })
        }
        const user = await userModel.findOne({ email })
        if(!user) {
            return res.status(400).send({ message: 'Invalid email or password' })
        }
        const isPasswordCorrect = await bcrypt.compare(password, user.password)
        if(!isPasswordCorrect) {
            return res.status(400).send({ message: 'Invalid email or password' })
        }
        const token = jwt.sign({ id: user._id }, JWT_SECRET)
        res.setHeader('authorization', `Bearer ${token}`)
        // Also include the token in the JSON body so the frontend can read it reliably with CORS.
        res.status(200).send({
            message: 'Login successful',
            token,
            user: { id: user._id, username: user.username },
        })
    } catch (error) {
        return res.status(500).send({ message: 'Internal server error' });
    }
};

/**
 * POST /password/forgot
 * body: { email }
 *
 * For local/dev usage this returns a resetToken so the UI can complete the flow.
 * In production, this should email a reset link instead.
 */
const forgotPassword = async (req, res) => {
    try {
        const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : ''
        if (!email) return res.status(400).send({ message: 'Email is required' })

        const user = await userModel.findOne({ email, isDeleted: { $ne: true } })

        // Always return a generic message to avoid account enumeration.
        const generic = { message: 'If an account exists for this email, reset instructions will be available.' }
        if (!user) return res.status(200).send(generic)

        const resetToken = crypto.randomBytes(24).toString('hex')
        const resetPasswordTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex')
        const resetPasswordExpiresAt = new Date(Date.now() + 1000 * 60 * 15) // 15 minutes

        await userModel.updateOne(
            { _id: user._id },
            { $set: { resetPasswordTokenHash, resetPasswordExpiresAt } }
        )

        return res.status(200).send({ ...generic, resetToken })
    } catch (error) {
        return res.status(500).send({ message: 'Internal server error' })
    }
}

/**
 * POST /password/reset
 * body: { token, newPassword }
 */
const resetPassword = async (req, res) => {
    try {
        const token = typeof req.body?.token === 'string' ? req.body.token.trim() : ''
        const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : ''
        if (!token) return res.status(400).send({ message: 'Reset token is required' })
        if (!newPassword || newPassword.length < 8) return res.status(400).send({ message: 'Password must be at least 8 characters' })

        const hash = crypto.createHash('sha256').update(token).digest('hex')
        const user = await userModel.findOne({
            resetPasswordTokenHash: hash,
            resetPasswordExpiresAt: { $gt: new Date() },
            isDeleted: { $ne: true },
        })
        if (!user) {
            return res.status(400).send({ message: 'Reset link is invalid or expired. Please request a new one.' })
        }

        user.password = await bcrypt.hash(newPassword, 10)
        user.resetPasswordTokenHash = null
        user.resetPasswordExpiresAt = null
        await user.save()

        return res.status(200).send({ message: 'Password updated successfully. Please login.' })
    } catch (error) {
        return res.status(500).send({ message: 'Internal server error' })
    }
}

const getProfile = async (req, res) => {
    try {
        const userId = req.user.id
        const doc = await userModel
            .findById(userId)
            .select(
                'username email phoneNumber profilePicture coverImage bio address education dob gender maritalStatus occupation isDeleted isActive isVerified isPremium isAdmin isSuperAdmin followers following'
            )
            .lean()
        if (!doc) {
            return res.status(400).send({ message: 'User not found' })
        }
        const followers = doc.followers || []
        const following = doc.following || []
        const { followers: _f, following: _fol, ...rest } = doc
        const user = {
            ...rest,
            followersCount: followers.length,
            followingCount: following.length,
            followingIds: following.map((id) => String(id)),
        }
        res.status(200).send({ message: 'Profile fetched successfully', user })
    } catch (error) {
        return res.status(500).send({ message: 'Internal server error' })
    }
}
const updateProfile = async (req, res) => {
    try {
        let userId=req.user.id;
        const {
            username,
            email,
            phoneNumber,
            bio,
            address,
            education,
            dob,
            gender,
            maritalStatus,
            occupation,
        } = req.body

        // Parse `profilePicture` and `coverImage` if sent via multipart/form-data.
        let profilePictureUrl = null
        let coverImageUrl = null
        
        if (req.file) {
            if (req.file.fieldname === 'profilePicture') profilePictureUrl = await uploadProfile(req.file)
            else if (req.file.fieldname === 'coverImage') coverImageUrl = await uploadProfile(req.file)
        }
        if (req.files) {
            if (req.files.profilePicture?.[0]) profilePictureUrl = await uploadProfile(req.files.profilePicture[0])
            if (req.files.coverImage?.[0]) coverImageUrl = await uploadProfile(req.files.coverImage[0])
        }

        // Normalize types so updates don't break the Mongoose schema types.
        const normalizedEducation = (() => {
            if (education === undefined || education === null) return undefined
            if (education === '') return undefined
            if (Array.isArray(education)) return education
            if (typeof education === 'string') {
                if (!education.trim()) return undefined
                return education
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean)
            }
            return undefined
        })()

        const normalizedDob = (() => {
            if (!dob) return null
            const parsed = new Date(dob)
            if (Number.isNaN(parsed.getTime())) return null
            return parsed
        })()

        const normalizedAddress = (() => {
            if (!address) return undefined
            // Allow both JSON object strings and plain street strings.
            if (typeof address === 'string') {
                try {
                    const parsed = JSON.parse(address)
                    return parsed
                } catch {
                    return { street: address }
                }
            }
            return address
        })()

        let updatedData = {
            username,
            email,
            phoneNumber,
            bio,
            ...(normalizedAddress !== undefined ? { address: normalizedAddress } : {}),
            ...(normalizedEducation !== undefined ? { education: normalizedEducation } : {}),
            dob: normalizedDob,
            gender,
            maritalStatus,
            occupation,
        }

        if (req.body.deleteProfilePicture === 'true') {
            updatedData.profilePicture = null
        } else if (profilePictureUrl) {
            updatedData.profilePicture = profilePictureUrl
        }

        if (req.body.deleteCoverImage === 'true') {
            updatedData.coverImage = null
        } else if (coverImageUrl) {
            updatedData.coverImage = coverImageUrl
        }

        const updatedUser = await userModel
            .findByIdAndUpdate(userId, updatedData, { new: true })
            .select('-password')
        res.status(200).send({ message: 'Profile updated successfully', updatedUser: safeUser(updatedUser) })
    } catch (error) {
        return res.status(500).send({ message: 'Internal server error' });
    }
}
const followUser = async (req, res) => {
    try {
        const userId = req.user.id
        const { followingUserId } = req.body
        if (!followingUserId || !validateObjectId(followingUserId)) {
            return res.status(400).send({ message: 'Valid followingUserId is required' })
        }
        if (idEquals(userId, followingUserId)) {
            return res.status(400).send({ message: 'You cannot follow yourself' })
        }

        const user = await userModel.findById(userId)
        if (!user) {
            return res.status(400).send({ message: 'Current user not found' })
        }
        if (listHasId(user.following, followingUserId)) {
            return res.status(400).send({ message: 'User already followed' })
        }
        const followingUser = await userModel.findById(followingUserId)
        if (!followingUser || followingUser.isDeleted) {
            return res.status(400).send({ message: 'User not found' })
        }

        user.following.push(new mongoose.Types.ObjectId(followingUserId))
        followingUser.followers.push(new mongoose.Types.ObjectId(userId))
        await user.save()
        await followingUser.save()

        const me = await userModel.findById(userId).select('-password').lean()
        const them = await userModel.findById(followingUserId).select('-password').lean()

        return res.status(200).send({
            message: 'User followed successfully',
            user: me,
            followingUser: them,
            followersCount: them.followers?.length ?? 0,
            followingCount: me.following?.length ?? 0,
        })
    } catch (error) {
        return res.status(500).send({ message: 'Internal server error' })
    }
}

const unfollowUser = async (req, res) => {
    try {
        const userId = req.user.id
        const { followingUserId } = req.body
        if (!followingUserId || !validateObjectId(followingUserId)) {
            return res.status(400).send({ message: 'Valid followingUserId is required' })
        }
        if (idEquals(userId, followingUserId)) {
            return res.status(400).send({ message: 'Invalid request' })
        }

        const user = await userModel.findById(userId)
        const other = await userModel.findById(followingUserId)
        if (!user || !other) {
            return res.status(400).send({ message: 'User not found' })
        }
        if (!listHasId(user.following, followingUserId)) {
            return res.status(400).send({ message: 'You are not following this user' })
        }

        user.following = user.following.filter((id) => !idEquals(id, followingUserId))
        other.followers = other.followers.filter((id) => !idEquals(id, userId))
        await user.save()
        await other.save()

        const me = await userModel.findById(userId).select('-password').lean()
        const them = await userModel.findById(followingUserId).select('-password').lean()

        return res.status(200).send({
            message: 'Unfollowed successfully',
            user: me,
            followingUser: them,
            followersCount: them.followers?.length ?? 0,
            followingCount: me.following?.length ?? 0,
        })
    } catch (error) {
        return res.status(500).send({ message: 'Internal server error' })
    }
}

/**
 * GET /users/:userId — public card (Instagram-style); extra fields only for own profile via /profile.
 */
const getPublicUser = async (req, res) => {
    try {
        const { userId } = req.params
        if (!validateObjectId(userId)) {
            return res.status(400).send({ message: 'Invalid user id' })
        }
        const target = await userModel
            .findOne({ _id: userId, isDeleted: { $ne: true } })
            .select('username profilePicture coverImage bio occupation followers following')
            .lean()
        if (!target) {
            return res.status(404).send({ message: 'User not found' })
        }

        const followers = target.followers || []
        const following = target.following || []
        let isFollowing = false
        if (req.user?.id) {
            const me = await userModel.findById(req.user.id).select('following').lean()
            isFollowing = listHasId(me?.following, userId)
        }

        const profile = {
            _id: target._id,
            username: target.username,
            profilePicture: target.profilePicture,
            coverImage: target.coverImage,
            bio: target.bio,
            occupation: target.occupation,
            followersCount: followers.length,
            followingCount: following.length,
            isFollowing,
        }
        return res.status(200).send({ message: 'User profile', profile })
    } catch (error) {
        return res.status(500).send({ message: 'Internal server error' })
    }
}

const orderedUsersByIds = async (ids) => {
    if (!ids.length) return []
    const users = await userModel
        .find({ _id: { $in: ids }, isDeleted: { $ne: true } })
        .select('username profilePicture occupation bio')
        .lean()
    const map = new Map(users.map((u) => [String(u._id), u]))
    return ids.map((id) => map.get(String(id))).filter(Boolean)
}

const getUserFollowers = async (req, res) => {
    try {
        const { userId } = req.params
        if (!validateObjectId(userId)) {
            return res.status(400).send({ message: 'Invalid user id' })
        }
        const target = await userModel.findById(userId).select('followers').lean()
        if (!target) {
            return res.status(404).send({ message: 'User not found' })
        }
        const { page, limit, skip } = normalizePagination(req.query)
        const raw = target.followers || []
        const total = raw.length
        const newestFirst = [...raw].reverse()
        const pageIds = newestFirst.slice(skip, skip + limit)
        const users = await orderedUsersByIds(pageIds)
        return res.status(200).send({
            message: 'Followers',
            page,
            limit,
            total,
            users,
        })
    } catch (error) {
        return res.status(500).send({ message: 'Internal server error' })
    }
}

const getUserFollowing = async (req, res) => {
    try {
        const { userId } = req.params
        if (!validateObjectId(userId)) {
            return res.status(400).send({ message: 'Invalid user id' })
        }
        const target = await userModel.findById(userId).select('following').lean()
        if (!target) {
            return res.status(404).send({ message: 'User not found' })
        }
        const { page, limit, skip } = normalizePagination(req.query)
        const raw = target.following || []
        const total = raw.length
        const newestFirst = [...raw].reverse()
        const pageIds = newestFirst.slice(skip, skip + limit)
        const users = await orderedUsersByIds(pageIds)
        return res.status(200).send({
            message: 'Following',
            page,
            limit,
            total,
            users,
        })
    } catch (error) {
        return res.status(500).send({ message: 'Internal server error' })
    }
}

/**
 * GET /users
 * Query: page, limit, q (optional search by username)
 * Returns: users[] with isFollowing
 */
const listUsers = async (req, res) => {
    try {
        const meId = req.user?.id
        if (!meId || !validateObjectId(meId)) {
            return res.status(401).send({ message: 'Unauthorized' })
        }
        const { page, limit, skip } = normalizePagination(req.query)
        const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''

        const me = await userModel.findById(meId).select('following').lean()
        const followingSet = new Set((me?.following || []).map((id) => String(id)))

        const filter = { isDeleted: { $ne: true } }
        if (q) {
            filter.username = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' }
        }

        const [users, total] = await Promise.all([
            userModel
                .find(filter)
                .select('username profilePicture bio occupation')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            userModel.countDocuments(filter),
        ])

        const items = users
            .filter((u) => String(u._id) !== String(meId))
            .map((u) => ({
                _id: u._id,
                username: u.username,
                profilePicture: u.profilePicture,
                bio: u.bio,
                occupation: u.occupation,
                isFollowing: followingSet.has(String(u._id)),
            }))

        return res.status(200).send({ message: 'Users', page, limit, total, users: items })
    } catch (error) {
        return res.status(500).send({ message: 'Internal server error' })
    }
}

/**
 * GET /notifications
 * Shows posts/jobs created by people the current user follows, since last seen.
 */
const getNotifications = async (req, res) => {
    try {
        const userId = req.user?.id
        if (!userId || !validateObjectId(userId)) {
            return res.status(401).send({ message: 'Unauthorized' })
        }

        const { limit } = normalizePagination(req.query)
        const me = await userModel.findById(userId).select('following notificationsLastSeenAt').lean()
        if (!me) return res.status(404).send({ message: 'User not found' })

        const following = me.following || []
        const since = me.notificationsLastSeenAt ? new Date(me.notificationsLastSeenAt) : null

        const filter = {
            status: 'active',
            userId: { $in: following },
        }
        if (since) {
            filter.createdAt = { $gt: since }
        }

        const items = await postModel
            .find(filter)
            .sort({ createdAt: -1 })
            .limit(limit)
            .populate('userId', 'username profilePicture')
            .select('postType content job createdAt userId')
            .lean()

        const counts = items.reduce(
            (acc, p) => {
                if (p.postType === 'job') acc.jobs += 1
                else acc.posts += 1
                acc.all += 1
                return acc
            },
            { all: 0, posts: 0, jobs: 0 }
        )

        return res.status(200).send({
            message: 'Notifications',
            since: since ? since.toISOString() : null,
            counts,
            items,
        })
    } catch (error) {
        return res.status(500).send({ message: 'Internal server error' })
    }
}

/**
 * POST /notifications/seen
 * Marks notifications as seen (sets notificationsLastSeenAt = now).
 */
const markNotificationsSeen = async (req, res) => {
    try {
        const userId = req.user?.id
        if (!userId || !validateObjectId(userId)) {
            return res.status(401).send({ message: 'Unauthorized' })
        }
        const now = new Date()
        await userModel.updateOne({ _id: userId }, { $set: { notificationsLastSeenAt: now } })
        return res.status(200).send({ message: 'OK', seenAt: now.toISOString() })
    } catch (error) {
        return res.status(500).send({ message: 'Internal server error' })
    }
}

export {
    createUser,
    loginUser,
    getProfile,
    updateProfile,
    followUser,
    unfollowUser,
    listUsers,
    getNotifications,
    markNotificationsSeen,
    forgotPassword,
    resetPassword,
    getPublicUser,
    getUserFollowers,
    getUserFollowing,
}