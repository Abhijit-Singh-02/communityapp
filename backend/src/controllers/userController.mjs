import userModel from '../models/userModel.mjs'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { JWT_SECRET } from '../../config.mjs'
import uploadProfile from '../aws/uploadProfile.mjs'
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
            return res.status(400).send({ message: 'User not found' })
        }
        const isPasswordCorrect = await bcrypt.compare(password, user.password)
        if(!isPasswordCorrect) {
            return res.status(400).send({ message: 'Invalid password' })
        }
        const token = jwt.sign({ id: user._id }, JWT_SECRET)
        res.setHeader('authorization', `Bearer ${token}`)
        // Also include the token in the JSON body so the frontend can read it reliably with CORS.
        res.status(200).send({ message: 'Login successful', user: {id: user._id, username: user.username} });
    } catch (error) {
        return res.status(500).send({ message: 'Internal server error' });
    }
};

const getProfile = async (req, res) => {
    try {
        let userId=req.user.id;
        const user = await userModel.findById(userId).select('username email phoneNumber profilePicture bio address education dob gender maritalStatus occupation isDeleted isActive isVerified isPremium isAdmin isSuperAdmin isSuperAdmin')
        if(!user) {
            return res.status(400).send({ message: 'User not found' })
        }
        res.status(200).send({ message: 'Profile fetched successfully', user })
    } catch (error) {
        return res.status(500).send({ message: 'Internal server error' });
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

        // `profilePicture` is sent as a multipart upload; multer puts it on `req.file`.
        let profilePictureUrl = null
        if (req.file) {
            profilePictureUrl = await uploadProfile(req.file)
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

        if (profilePictureUrl) {
            updatedData.profilePicture = profilePictureUrl
        }

        const updatedUser = await userModel.findByIdAndUpdate(userId, updatedData, { new: true })
        res.status(200).send({ message: 'Profile updated successfully', updatedUser })
    } catch (error) {
        return res.status(500).send({ message: 'Internal server error' });
    }
}

export { createUser, loginUser, getProfile, updateProfile };