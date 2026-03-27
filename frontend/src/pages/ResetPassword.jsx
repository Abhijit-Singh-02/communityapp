import React, { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import axios from 'axios'
import { serverUrl } from '../../config.mjs'
import styles from './ResetPassword.module.css'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const tokenFromUrl = params.get('token') || ''

  const [token, setToken] = useState(tokenFromUrl)
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  const canSubmit = useMemo(() => {
    if (busy) return false
    if (!token.trim()) return false
    if (!newPassword) return false
    if (newPassword.length < 8) return false
    if (newPassword !== confirm) return false
    return true
  }, [busy, token, newPassword, confirm])

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    setInfo('')
    try {
      const res = await axios.post(
        `${serverUrl}/password/reset`,
        { token: token.trim(), newPassword },
        { headers: { 'Content-Type': 'application/json' } }
      )
      setInfo(res.data?.message || 'Password updated successfully. Please login.')
      setTimeout(() => navigate('/login'), 800)
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not reset password.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>Reset password</h1>
        <p className={styles.subTitle}>Set a new password for your account.</p>

        <form className={styles.form} onSubmit={submit}>
          <label className={styles.label}>
            Reset token
            <input className={styles.input} value={token} onChange={(e) => setToken(e.target.value)} placeholder="Paste token" />
          </label>

          <label className={styles.label}>
            New password
            <input
              className={styles.input}
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 8 characters"
            />
          </label>

          <label className={styles.label}>
            Confirm password
            <input className={styles.input} type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </label>

          {error && (
            <div className={styles.alertError}>
              <div className={styles.alertTitle}>Couldn’t reset password</div>
              <div className={styles.alertText}>{error}</div>
              <div className={styles.nextSteps}>
                <div className={styles.nextTitle}>Next steps</div>
                <ul>
                  <li>Request a new reset token.</li>
                  <li>Make sure the token hasn’t expired (15 minutes).</li>
                </ul>
              </div>
            </div>
          )}

          {info && <div className={styles.alertInfo}>{info}</div>}

          <button type="submit" className={styles.btn} disabled={!canSubmit}>
            {busy ? 'Saving…' : 'Update password'}
          </button>
        </form>

        <p className={styles.footer}>
          <Link to="/forgot-password">Request a new token</Link> · <Link to="/login">Back to login</Link>
        </p>
      </div>
    </div>
  )
}

