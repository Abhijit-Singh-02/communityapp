import mongoose from 'mongoose'
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true  },
    password: { type: String, required: true },
    phoneNumber: { type: String, required: true },
    profilePicture: { type: String, default: null },
    bio: { type: String, default: null },
    address: { 
        street: { type: String, default: null },
        city: { type: String, default: null },
        state: { type: String, default: null },
        zip: { type: String, default: null },
        country: { type: String, default: null },
    },
    education: { type: [String], default: [] },
    dob: { type: Date, default: null },
    gender: { type: String, default: null },
    maritalStatus: { type: String, default: null },
    occupation: { type: String, default: null },
    isDeleted: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    isVerified: { type: Boolean, default: false },
    isPremium: { type: Boolean, default: false },
    isAdmin: { type: Boolean, default: false },
    isSuperAdmin: { type: Boolean, default: false },
    isSuperAdmin: { type: Boolean, default: false },
},{timestamps: true})
const userModel = mongoose.model('User', userSchema)
export default userModel;