import React,{useState} from 'react'
import styles from './SignUp.module.css'
import CustomButton from '../buttons/CustomButton'
import { Link,useNavigate } from 'react-router-dom'
import logoPng from '../../assets/logo.png'
import axios from 'axios'
import { serverUrl } from '../../../config.mjs'
export default function SignUp() {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    phoneNumber: '',
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
    if(formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    try {
      setBusy(true)
      const response = await axios.post(`${serverUrl}/signup`, formData,{'Content-Type': 'application/json'})
      if(response.status === 201) {
        navigate('/login')
      }
    } catch (error) {
      const msg = error?.response?.data?.message
      if (error?.response?.status === 400) {
        setError(msg || 'Please check the details and try again.')
      } else {
        setError(msg || 'We could not create your account right now. Please try again in a moment.')
      }
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className={styles.signUpPage}>
      <aside className={styles.leftPanel}>
        <img src={logoPng} alt="Community logo" className={styles.leftLogo} />
        <h2 className={styles.leftTitle}>Join the community</h2>
        <p className={styles.leftSubtitle}>
          Create your account in seconds and get access to member-only features.
        </p>
      </aside>

      <main className={styles.rightPanel}>
        <h1 className={styles.signUpTitle}>Sign Up</h1>
        <form className={styles.signUpForm}>
          <input type="text" placeholder="Username" name="username" value={formData.username} onChange={handleChange} />
          <input type="email" placeholder="Email" name="email" value={formData.email} onChange={handleChange} />
          <input type="password" placeholder="Password" name="password" value={formData.password} onChange={handleChange} />
          <input type="password" placeholder="Confirm Password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} />
          <input type="text" placeholder="Phone Number" name="phoneNumber" value={formData.phoneNumber} onChange={handleChange} />
          {error && (
            <div className={styles.inlineError}>
              <div className={styles.inlineErrorTitle}>Couldn’t create account</div>
              <div className={styles.inlineErrorText}>{error}</div>
              <div className={styles.inlineNext}>
                <div className={styles.inlineNextTitle}>Next steps</div>
                <ul>
                  <li>Check that your email and username are unique.</li>
                  <li>Use a strong password (8+ characters).</li>
                </ul>
              </div>
            </div>
          )}
          <CustomButton text={busy ? "Creating..." : "Sign Up"} handler={handleSubmit} />
        </form>
        <p className={styles.signUpText}>
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </main>
    </div>
  )
}
