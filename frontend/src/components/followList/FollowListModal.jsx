import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { serverUrl } from '../../../config.mjs'
import styles from './FollowListModal.module.css'

export default function FollowListModal({ open, onClose, userId, variant, title }) {
  const navigate = useNavigate()
  const token = localStorage.getItem('token')
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open || !userId || !token) return
    const path = variant === 'followers' ? 'followers' : 'following'
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const res = await axios.get(`${serverUrl}/users/${userId}/${path}`, {
          headers: { Authorization: `Bearer ${token}` },
          params: { page: 1, limit: 50 },
        })
        if (!cancelled) setUsers(res.data?.users || [])
      } catch (err) {
        if (!cancelled) {
          setError(err?.response?.data?.message || 'Could not load list.')
          setUsers([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()

    // Handle ESC gracefully
    const handleEsc = (e) => {
        if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEsc)

    return () => {
      cancelled = true
      window.removeEventListener('keydown', handleEsc)
    }
  }, [open, userId, variant, token, onClose])

  if (!open) return null

  const goProfile = (u) => {
    if (!u?._id || !u?.username) return
    onClose()
    navigate(`/${u._id}/${u.username}/profile`)
  }

  // Graceful empty states
  const emptyMessage = variant === 'followers' ? 'No followers yet.' : 'Not following anyone yet.'

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        
        {/* Modal Header */}
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>{title}</h2>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {/* Modal Body */}
        <div className={styles.modalBody}>
          {loading && <div className={styles.hintContainer}><div className={styles.hintText}>Loading {title.toLowerCase()}…</div></div>}
          {!loading && error && <div className={styles.hintContainer}><div className={styles.errText}>{error}</div></div>}
          
          {!loading && !error && users.length === 0 && (
            <div className={styles.emptyContainer}>
                <div className={styles.emptyIcon}>👥</div>
                <div className={styles.hintText}>{emptyMessage}</div>
                <div className={styles.subHintText}>Connections will appear here.</div>
            </div>
          )}
          
          <ul className={styles.userList}>
            {users.map((u) => (
              <li key={u._id} className={styles.userRowWrapper}>
                <button type="button" className={styles.userRow} onClick={() => goProfile(u)}>
                  
                  {/* Avatar */}
                  <span className={styles.avatar} aria-hidden>
                    {u.profilePicture ? (
                      <img src={u.profilePicture} alt="" className={styles.avatarImg} draggable="false" />
                    ) : (
                      (u.username || 'U').slice(0, 1).toUpperCase()
                    )}
                  </span>
                  
                  {/* User Details */}
                  <div className={styles.userDetails}>
                    <span className={styles.name}>{u.username || 'User'}</span>
                    <span className={styles.occupation}>{u.occupation || u.bio || 'Member'}</span>
                  </div>
                  
                  {/* Inline follow / view trigger simulation */}
                  <div className={styles.viewBadge}>View</div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
