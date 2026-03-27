import React, { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { serverUrl } from '../../config.mjs'
import styles from './ForgotPassword.module.css'

export default function ForgotPassword() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [resetToken, setResetToken] = useState('')

  const canSubmit = useMemo(() => email.trim().length > 0 && !busy, [email, busy])

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    setInfo('')
    setResetToken('')
    try {
      const res = await axios.post(
        `${serverUrl}/password/forgot`,
        { email: email.trim() },
        { headers: { 'Content-Type': 'application/json' } }
      )
      setInfo(res.data?.message || 'If an account exists for this email, reset instructions will be available.')
      if (res.data?.resetToken) {
        setResetToken(res.data.resetToken)
      }
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not start password reset.')
    } finally {
      setBusy(false)
    }
  }

  const goReset = () => {
    if (!resetToken) return
    navigate(`/reset-password?token=${encodeURIComponent(resetToken)}`)
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>Forgot password</h1>
        <p className={styles.subTitle}>
          Enter your email address. If an account exists, you’ll be able to reset your password.
        </p>

        <form className={styles.form} onSubmit={submit}>
          <label className={styles.label}>
            Email
            <input
              className={styles.input}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </label>

          {error && (
            <div className={styles.alertError}>
              <div className={styles.alertTitle}>Couldn’t continue</div>
              <div className={styles.alertText}>{error}</div>
              <div className={styles.nextSteps}>
                <div className={styles.nextTitle}>Next steps</div>
                <ul>
                  <li>Check for typos in your email address.</li>
                  <li>Try again in a moment.</li>
                </ul>
              </div>
            </div>
          )}

          {info && (
            <div className={styles.alertInfo}>
              <div className={styles.alertText}>{info}</div>
            </div>
          )}

          {resetToken && (
            <div className={styles.devBox}>
              <div className={styles.devTitle}>Reset token</div>
              <div className={styles.devText}>
                This environment returns a reset token so you can complete the flow locally.
              </div>
              <div className={styles.tokenRow}>
                <code className={styles.token}>{resetToken}</code>
                <button type="button" className={styles.btnSecondary} onClick={goReset}>
                  Reset password
                </button>
              </div>
            </div>
          )}

          <button type="submit" className={styles.btn} disabled={!canSubmit}>
            {busy ? 'Sending…' : 'Continue'}
          </button>
        </form>

        <p className={styles.footer}>
          <Link to="/login">Back to login</Link>
        </p>
      </div>
    </div>
  )
}

