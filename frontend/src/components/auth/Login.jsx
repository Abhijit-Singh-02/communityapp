import React,{useState} from 'react'
import styles from './Login.module.css'
import logoPng from '../../assets/logo.png'
import CustomButton from '../buttons/CustomButton'
import { Link,useNavigate } from 'react-router-dom'
import axios from 'axios'
import { serverUrl } from '../../../config.mjs'
export default function Login() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  })
  const navigate = useNavigate()
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }
  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const response = await axios.post(`${serverUrl}/login`, formData,{'Content-Type': 'application/json'})
      if(response.status === 200) {
        // Prefer token from JSON body (works with CORS); fallback to header.
        const tokenFromBody = response.data?.token
        const tokenFromHeader = response.headers?.authorization?.split(' ')?.[1]
        const token = tokenFromBody || tokenFromHeader
        if (!token) {
          alert('Login successful but token was not returned by the server.')
          return
        }
        localStorage.setItem('token', token)
        let userId=response.data.user.id
        let username=response.data.user.username
        localStorage.setItem('userId', userId)
        navigate(`/`)
        localStorage.setItem('username', username)
      }else{
        alert(response.data.message)
      }
    } catch (error) {
      console.log(error)
    }
  }
  return (
    <div className={styles.loginPage}>
      <aside className={styles.leftPanel}>
        <img src={logoPng} alt="Community logo" className={styles.leftLogo} />
        <h2 className={styles.leftTitle}>Welcome back</h2>
        <p className={styles.leftSubtitle}>
          Login to your account to continue
        </p>
      </aside>
      <main className={styles.rightPanel}>
        <h1 className={styles.loginTitle}>Login</h1>
        <form className={styles.loginForm}>
          <input type="email" placeholder="Email" name="email" onChange={handleChange} value={formData.email}/>
          <input type="password" placeholder="Password" name="password" onChange={handleChange} value={formData.password}/>
          <CustomButton text="Login" handler={handleSubmit}/>
        </form>
        <p className={styles.loginText}>Don't have an account? <Link to="/signup">Sign Up</Link></p>
      </main>
    </div>
  )
}
