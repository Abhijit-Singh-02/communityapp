import React, { useCallback, useEffect, useMemo, useState } from 'react'
import styles from './Connect.module.css'
import HeaderNav from '../components/navs/HeaderNav'
import axios from 'axios'
import { serverUrl } from '../../config.mjs'
import { useNavigate } from 'react-router-dom'
export default function Connect() {
  const navigate = useNavigate()
  const token = useMemo(() => localStorage.getItem('token'), [])
  const currentUserId = localStorage.getItem('userId') || ''

  const [users, setUsers] = useState([])
  const [followingIds, setFollowingIds] = useState(() => new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(null)
  const [q, setQ] = useState('')

  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token])

  const loadUsers = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError('')
    try {
      const [profileRes, usersRes] = await Promise.all([
        axios.get(`${serverUrl}/profile`, { headers: authHeaders }),
        axios.get(`${serverUrl}/users`, {
          headers: authHeaders,
          params: { page: 1, limit: 50, ...(q.trim() ? { q: q.trim() } : {}) },
        }),
      ])
      const ids = profileRes.data?.user?.followingIds || []
      setFollowingIds(new Set(ids.map(String)))
      setUsers(usersRes.data?.users || [])
    } catch (err) {
      if (err?.response?.status === 401) navigate('/login', { replace: true })
      setError(err?.response?.data?.message || 'Could not load users.')
    } finally {
      setLoading(false)
    }
  }, [token, authHeaders, navigate, q])

  useEffect(() => {
    if (!token) {
      navigate('/login', { replace: true })
      return
    }
    loadUsers()
  }, [token, navigate, loadUsers])

  const toggleFollow = async (userId) => {
    if (!userId || !token || busy) return
    const idStr = String(userId)
    if (idStr === String(currentUserId)) return
    const isFollowing = followingIds.has(idStr)
    setBusy(`follow:${idStr}`)
    setError('')
    try {
      if (isFollowing) {
        await axios.post(
          `${serverUrl}/unfollow`,
          { followingUserId: idStr },
          { headers: { ...authHeaders, 'Content-Type': 'application/json' } }
        )
        setFollowingIds((prev) => {
          const next = new Set(prev)
          next.delete(idStr)
          return next
        })
      } else {
        await axios.post(
          `${serverUrl}/follow`,
          { followingUserId: idStr },
          { headers: { ...authHeaders, 'Content-Type': 'application/json' } }
        )
        setFollowingIds((prev) => new Set([...prev, idStr]))
      }
      setUsers((prev) =>
        prev.map((u) => (String(u._id) === idStr ? { ...u, isFollowing: !isFollowing } : u))
      )
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not update follow.')
    } finally {
      setBusy(null)
    }
  }

  const openProfile = (u) => {
    if (!u?._id || !u?.username) return
    navigate(`/${u._id}/${u.username}/profile`)
  }

  return (
    <div className={styles.page}>
      <HeaderNav />
      <div className={styles.connectContainer}>
        <div className={styles.connectHeader}>
          <h1 className={styles.title}>Connect</h1>
          <div className={styles.searchRow}>
            <input
              className={styles.search}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search users…"
            />
            <button type="button" className={styles.searchBtn} onClick={loadUsers} disabled={loading}>
              Search
            </button>
          </div>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        {loading && <div className={styles.hint}>Loading users…</div>}

        {!loading && users.length === 0 && !error && <div className={styles.hint}>No users found.</div>}

        <div className={styles.grid}>
          {users.map((u) => {
            const isOwn = String(u._id) === String(currentUserId)
            const isFollowing = followingIds.has(String(u._id)) || !!u.isFollowing
            return (
              <article key={u._id} className={styles.card}>
                <button type="button" className={styles.profileBtn} onClick={() => openProfile(u)}>
                  <span className={styles.avatar} aria-hidden>
                    {u.profilePicture ? (
                      <img src={u.profilePicture} alt="" className={styles.avatarImg} />
                    ) : (
                      (u.username || 'U').slice(0, 1).toUpperCase()
                    )}
                  </span>
                  <div className={styles.meta}>
                    <div className={styles.username}>@{u.username || 'member'}</div>
                    {(u.occupation || u.bio) && (
                      <div className={styles.subline}>{u.occupation || u.bio}</div>
                    )}
                  </div>
                </button>

                {!isOwn && (
                  <button
                    type="button"
                    className={`${styles.followBtn} ${isFollowing ? styles.following : ''}`}
                    onClick={() => toggleFollow(u._id)}
                    disabled={busy === `follow:${String(u._id)}`}
                  >
                    {busy === `follow:${String(u._id)}` ? '…' : isFollowing ? 'Following' : 'Follow'}
                  </button>
                )}
              </article>
            )
          })}
        </div>
      </div>
    </div>
  )
}
