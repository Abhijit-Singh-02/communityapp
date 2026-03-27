import React from 'react'
import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import SignUp from './components/auth/SignUp'
import Login from './components/auth/Login'
import Profile from './pages/Profile'
import Posts from './pages/Posts'
import Reels from './pages/Reels'
import Connect from './pages/Connect'
import Jobs from './pages/Jobs'
import Notification from './pages/Notification'
import Messages from './pages/Messages'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
export default function App() {
  return (
    <div>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/:userId/:username/profile" element={<Profile />} />
        <Route path="/:userId/posts" element={<Posts />} />
        <Route path="/:userId/reels" element={<Reels />} />
        <Route path="/:userId/connect" element={<Connect />} />
        <Route path="/:userId/jobs" element={<Jobs />} />
        <Route path="/:userId/notifications" element={<Notification />} />
        <Route path="/:userId/messages" element={<Messages />} />
      </Routes>
    </div>
  )
}
