import React from 'react'
import styles from './Login.module.css'
import logoPng from '../../assets/logo.png'
import CustomButton from '../buttons/CustomButton'
import { Link } from 'react-router-dom'
export default function Login() {
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
          <input type="email" placeholder="Email" />
          <input type="password" placeholder="Password" />
          <CustomButton text="Login" />
        </form>
        <p className={styles.loginText}>Don't have an account? <Link to="/signup">Sign Up</Link></p>
      </main>
    </div>
  )
}
