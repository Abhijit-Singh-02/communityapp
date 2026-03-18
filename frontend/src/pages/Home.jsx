import React, { useEffect } from 'react'
import HeaderNav from '../components/navs/HeaderNav'
import { useNavigate } from 'react-router-dom'
export default function Home() {
    const navigate = useNavigate()
    useEffect(() => {
        const token = localStorage.getItem('token')
        console.log(token)
        if (!token) {
            navigate('/signup')
        }
    }, [navigate])
  return (
    <div>
        <HeaderNav />
    </div>
  )
}
