import React, { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { serverUrl } from '../../../config.mjs'
import styles from './ReelCommentsSheet.module.css'

export default function ReelCommentsSheet({ open, onClose, postId, postAuthorId, onPostUpdated }) {
  const token = localStorage.getItem('token')
  const currentUserId = localStorage.getItem('userId')
  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [comments, setComments] = useState([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(null)

  const canDelete = (c) => {
    const authorId =
      c?.userId && typeof c.userId === 'object' && c.userId._id != null
        ? String(c.userId._id)
        : String(c?.userId || '')
    if (authorId && String(authorId) === String(currentUserId)) return true
    if (postAuthorId != null && String(postAuthorId) === String(currentUserId)) return true
    return false
  }

  useEffect(() => {
    if (!open || !postId || !token) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const res = await axios.get(`${serverUrl}/posts/${postId}/comments`, {
          headers: authHeaders,
          params: { page: 1, limit: 50 },
        })
        if (!cancelled) setComments(res.data?.comments || [])
      } catch (err) {
        if (!cancelled) setError(err?.response?.data?.message || 'Could not load comments.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [open, postId, token, authHeaders])

  const submit = async (e) => {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed || !postId || !token || busy) return
    setBusy('submit')
    setError('')
    try {
      const res = await axios.post(
        `${serverUrl}/posts/${postId}/comments`,
        { text: trimmed },
        { headers: { ...authHeaders, 'Content-Type': 'application/json' } }
      )
      if (res.data?.comment) {
        setComments((prev) => [res.data.comment, ...prev])
      }
      if (res.data?.post && typeof onPostUpdated === 'function') onPostUpdated(res.data.post)
      setText('')
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not post comment.')
    } finally {
      setBusy(null)
    }
  }

  const del = async (commentId) => {
    if (!commentId || !token || busy) return
    if (!window.confirm('Delete this comment?')) return
    setBusy(`del:${commentId}`)
    setError('')
    try {
      const res = await axios.delete(`${serverUrl}/comments/${commentId}`, { headers: authHeaders })
      const deletedIds = new Set((res.data?.deletedIds || [commentId]).map(String))
      setComments((prev) => prev.filter((c) => !deletedIds.has(String(c._id))))
      if (res.data?.post && typeof onPostUpdated === 'function') onPostUpdated(res.data.post)
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not delete.')
    } finally {
      setBusy(null)
    }
  }

  if (!open) return null

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Comments">
      <button type="button" className={styles.backdrop} aria-label="Close" onClick={onClose} />
      <div className={styles.sheet}>
        <div className={styles.header}>
          <div className={styles.handle} aria-hidden />
          <div className={styles.titleRow}>
            <h2 className={styles.title}>Comments</h2>
            <button type="button" className={styles.closeBtn} onClick={onClose}>
              ×
            </button>
          </div>
        </div>

        <div className={styles.body}>
          {loading && <p className={styles.hint}>Loading…</p>}
          {!loading && error && <p className={styles.err}>{error}</p>}
          {!loading && !error && comments.length === 0 && <p className={styles.hint}>Be the first to comment.</p>}

          <ul className={styles.list}>
            {comments.map((c) => (
              <li key={c._id} className={styles.item}>
                <div className={styles.avatar} aria-hidden>
                  {(c?.userId?.username || 'M').slice(0, 1).toUpperCase()}
                </div>
                <div className={styles.content}>
                  <div className={styles.nameRow}>
                    <span className={styles.name}>{c?.userId?.username || 'Member'}</span>
                    {canDelete(c) && (
                      <button
                        type="button"
                        className={styles.deleteBtn}
                        onClick={() => del(c._id)}
                        disabled={busy === `del:${c._id}`}
                      >
                        {busy === `del:${c._id}` ? 'Deleting…' : 'Delete'}
                      </button>
                    )}
                  </div>
                  <p className={styles.text}>{c.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <form className={styles.composer} onSubmit={submit}>
          <input
            className={styles.input}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Add a comment…"
          />
          <button type="submit" className={styles.postBtn} disabled={busy === 'submit' || !text.trim()}>
            {busy === 'submit' ? 'Posting…' : 'Post'}
          </button>
        </form>
      </div>
    </div>
  )
}

