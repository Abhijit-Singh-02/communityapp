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
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }
  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!formData.email.trim() || !formData.password) {
      setError('Enter your email and password to continue.')
      return
    }
    try {
      setBusy(true)
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
        setError(response.data.message || 'Login failed.')
      }
    } catch (error) {
      const msg = error?.response?.data?.message
      if (msg && msg.toLowerCase().includes('invalid email or password')) {
        setError('Incorrect email or password. Check your details and try again.')
      } else if (error?.response?.status === 400) {
        setError(msg || 'Please check your details and try again.')
      } else {
        setError(msg || 'We could not sign you in right now. Please try again in a moment.')
      }
    } finally {
      setBusy(false)
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
          {error && (
            <div className={styles.inlineError}>
              <div className={styles.inlineErrorTitle}>Couldn’t sign you in</div>
              <div className={styles.inlineErrorText}>{error}</div>
              <div className={styles.inlineNext}>
                <div className={styles.inlineNextTitle}>Next steps</div>
                <ul>
                  <li>Double-check your email and password.</li>
                  <li>If you forgot your password, reset it below.</li>
                </ul>
              </div>
            </div>
          )}
          <CustomButton text={busy ? "Signing in..." : "Login"} handler={handleSubmit}/>
        </form>
        <p className={styles.forgotRow}>
          <Link to="/forgot-password">Forgot password?</Link>
        </p>
        <p className={styles.loginText}>Don't have an account? <Link to="/signup">Sign Up</Link></p>
      </main>
    </div>
  )
}
