import React from 'react'
import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import SignUp from './components/auth/SignUp'
import Login from './components/auth/Login'
import Profile from './pages/Profile'
export default function App() {
  return (
    <div>
      <Routes>
        <Route path="/:userId/:username" element={<Home />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/login" element={<Login />} />
        <Route path="/:userId/:username/profile" element={<Profile />} />
      </Routes>
    </div>
  )
}
