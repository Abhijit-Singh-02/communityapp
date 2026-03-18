import React from 'react'
import styles from './SignUp.module.css'
import CustomButton from '../buttons/CustomButton'
import { Link } from 'react-router-dom'
import logoPng from '../../assets/logo.png'
export default function SignUp() {
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
          <input type="text" placeholder="Username" />
          <input type="email" placeholder="Email" />
          <input type="password" placeholder="Password" />
          <input type="password" placeholder="Confirm Password" />
          <input type="text" placeholder="Phone Number" />
          <CustomButton text="Sign Up" />
        </form>
        <p className={styles.signUpText}>
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </main>
    </div>
  )
}
