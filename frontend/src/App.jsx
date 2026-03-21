import React from 'react'
import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import SignUp from './components/auth/SignUp'
import Login from './components/auth/Login'
import Profile from './pages/Profile'
import Posts from './pages/Posts'
export default function App() {
  return (
    <div>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/login" element={<Login />} />
        <Route path="/:userId/:username/profile" element={<Profile />} />
        <Route path="/:userId/posts" element={<Posts />} />
      </Routes>
    </div>
  )
}
