import React,{useState} from 'react'
import styles from './SignUp.module.css'
import CustomButton from '../buttons/CustomButton'
import { Link,useNavigate } from 'react-router-dom'
import logoPng from '../../assets/logo.png'
import axios from 'axios'
export default function SignUp() {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    phoneNumber: '',
  })
  const navigate = useNavigate()
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }
  const handleSubmit = async (e) => {
    e.preventDefault()
    if(formData.password !== formData.confirmPassword) {
      alert('Passwords do not match')
      return
    }
    try {
      const response = await axios.post('http://localhost:8080/signup', formData,{'Content-Type': 'application/json'})
      if(response.status === 201) {
        alert('User created successfully')
        navigate('/login')
      }
      console.log(response)
    } catch (error) {
      console.log(error)
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
          <CustomButton text="Sign Up" handler={handleSubmit} />
        </form>
        <p className={styles.signUpText}>
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </main>
    </div>
  )
}
