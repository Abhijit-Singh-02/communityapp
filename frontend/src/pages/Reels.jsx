import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import axios from 'axios'
import { serverUrl } from '../../config.mjs'
import styles from './Reels.module.css'
import HeaderNav from '../components/navs/HeaderNav'
import ReelCommentsSheet from '../components/reels/ReelCommentsSheet'

export default function Reels() {
  const token = localStorage.getItem('token')
  const currentUserId = localStorage.getItem('userId')

  const [reels, setReels] = useState([])
  const [page, setPage] = useState(1)
  const limit = 10
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeIdx, setActiveIdx] = useState(0)
  const [muted, setMuted] = useState(true)
  const [busy, setBusy] = useState(null)
  const [followingIds, setFollowingIds] = useState(() => new Set())
  const [commentsOpenFor, setCommentsOpenFor] = useState(null)
  const [commentsOpenAuthorId, setCommentsOpenAuthorId] = useState(null)

  const containerRef = useRef(null)
  const videoRefs = useRef({})

  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token])

  const pickReelsFromPosts = (posts = []) =>
    (posts || [])
      .filter((p) => String(p?.mediaType || '').includes('video') && p?.media)
      .map((p) => ({
        _id: p._id,
        media: p.media,
        mediaType: p.mediaType,
        content: p.content || '',
        createdAt: p.createdAt,
        user: p.userId && typeof p.userId === 'object' ? p.userId : { _id: p.userId, username: 'Member' },
        likes: p.likes || 0,
        likedBy: p.likedBy || [],
        commentsCount: p.commentsCount || 0,
        sharesCount: p.sharesCount || 0,
      }))

  const loadMore = useCallback(
    async (nextPage) => {
      if (!token || loading || !hasMore) return
      setLoading(true)
      setError('')
      try {
        const res = await axios.get(`${serverUrl}/posts`, {
          headers: authHeaders,
          params: { page: nextPage, limit },
        })
        const next = pickReelsFromPosts(res.data?.posts || [])
        setReels((prev) => {
          const seen = new Set(prev.map((r) => String(r._id)))
          const merged = [...prev]
          for (const r of next) {
            if (!seen.has(String(r._id))) merged.push(r)
          }
          return merged
        })
        setHasMore(next.length >= Math.max(1, Math.floor(limit / 2)))
        setPage(nextPage)
      } catch (err) {
        setError(err?.response?.data?.message || 'Could not load reels.')
      } finally {
        setLoading(false)
      }
    },
    [token, loading, hasMore, authHeaders]
  )

  useEffect(() => {
    if (!token) return
    loadMore(1)
  }, [token, loadMore])

  useEffect(() => {
    if (!token) return
    const loadFollowing = async () => {
      try {
        const res = await axios.get(`${serverUrl}/profile`, { headers: authHeaders })
        const ids = res.data?.user?.followingIds || []
        setFollowingIds(new Set(ids.map(String)))
      } catch {
        /* ignore */
      }
    }
    loadFollowing()
  }, [token, authHeaders])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onScroll = () => {
      const items = Array.from(el.querySelectorAll(`[data-reel-item="1"]`))
      if (items.length === 0) return

      const top = el.getBoundingClientRect().top
      let best = { idx: 0, dist: Number.POSITIVE_INFINITY }
      items.forEach((node, idx) => {
        const r = node.getBoundingClientRect()
        const dist = Math.abs(r.top - top)
        if (dist < best.dist) best = { idx, dist }
      })
      setActiveIdx(best.idx)

      const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 150
      if (nearBottom && hasMore && !loading) {
        loadMore(page + 1)
      }
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => el.removeEventListener('scroll', onScroll)
  }, [hasMore, loading, loadMore, page])

  useEffect(() => {
    const entries = Object.entries(videoRefs.current)
    entries.forEach(([idxStr, v]) => {
      const idx = Number(idxStr)
      if (!v) return
      v.muted = muted
      if (idx === activeIdx) {
        v.play?.().catch(() => {})
      } else {
        v.pause?.()
      }
    })
  }, [activeIdx, muted, reels.length])

  const isReelLiked = (reel) =>
    currentUserId &&
    Array.isArray(reel?.likedBy) &&
    reel.likedBy.some((id) => String(id) === String(currentUserId))

  const toggleLike = async (reel) => {
    if (!reel?._id || busy || !token) return
    setBusy(`like:${reel._id}`)
    setError('')
    try {
      const res = await axios.post(`${serverUrl}/posts/${reel._id}/like`, {}, { headers: authHeaders })
      const updated = res.data?.post
      if (updated?._id) {
        setReels((prev) =>
          prev.map((r) =>
            String(r._id) === String(updated._id)
              ? {
                  ...r,
                  likes: updated.likes,
                  likedBy: updated.likedBy || [],
                  commentsCount: updated.commentsCount,
                  sharesCount: updated.sharesCount,
                }
              : r
          )
        )
      }
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not update like.')
    } finally {
      setBusy(null)
    }
  }

  const share = async (reel) => {
    if (!reel?._id || busy || !token) return
    setBusy(`share:${reel._id}`)
    setError('')
    try {
      const res = await axios.post(`${serverUrl}/posts/${reel._id}/share`, {}, { headers: authHeaders })
      const updated = res.data?.post
      if (updated?._id) {
        setReels((prev) =>
          prev.map((r) =>
            String(r._id) === String(updated._id)
              ? { ...r, sharesCount: updated.sharesCount }
              : r
          )
        )
      }
      try {
        await navigator.clipboard.writeText(window.location.origin + '/')
      } catch {
        /* ignore */
      }
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not share.')
    } finally {
      setBusy(null)
    }
  }

  const toggleFollow = async (authorId) => {
    if (!authorId || !token) return
    if (String(authorId) === String(currentUserId)) return
    const idStr = String(authorId)
    const isFollowing = followingIds.has(idStr)
    setError('')
    setBusy(`follow:${idStr}`)
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
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not update follow.')
    } finally {
      setBusy(null)
    }
  }

  const togglePlay = (idx) => {
    const v = videoRefs.current[idx]
    if (!v) return
    if (v.paused) v.play?.().catch(() => {})
    else v.pause?.()
  }

  return (
    <div className={styles.page}>
      <HeaderNav />

      <main className={styles.reelsWrap}>
        {!token && (
          <div className={styles.centerCard}>
            <p className={styles.centerTitle}>Sign in to watch reels</p>
            <p className={styles.centerHint}>Reels require authentication in your backend.</p>
          </div>
        )}

        {token && (
          <>
            {error && <div className={styles.error}>{error}</div>}

            {!loading && reels.length === 0 && !error && (
              <div className={styles.centerCard}>
                <p className={styles.centerTitle}>No reels yet</p>
                <p className={styles.centerHint}>Upload a video post and it will show here.</p>
              </div>
            )}

            <div className={styles.frame}>
              <section ref={containerRef} className={styles.reelsScroller} aria-label="Reels">
                {reels.map((reel, idx) => {
                  const author = reel?.user?.username || 'Member'
                  const authorId = reel?.user?._id ?? reel?.userId ?? reel?.user
                  const authorPicture = reel?.user?.profilePicture || ''
                  const liked = isReelLiked(reel)
                  const isOwn = authorId && String(authorId) === String(currentUserId)
                  const isFollowing = authorId && followingIds.has(String(authorId))
                  return (
                    <article
                      key={reel._id}
                      className={styles.reelItem}
                      data-reel-item="1"
                      aria-label={`Reel by ${author}`}
                    >
                    <button
                      type="button"
                      className={styles.tapLayer}
                      onClick={() => togglePlay(idx)}
                      aria-label="Play or pause"
                    />

                    <video
                      ref={(node) => {
                        if (node) videoRefs.current[idx] = node
                      }}
                      className={styles.video}
                      src={reel.media}
                      playsInline
                      loop
                      muted={muted}
                      preload="metadata"
                    />

                    <div className={styles.topBar}>
                      <div className={styles.reelsTitle}>Reels</div>
                      <button type="button" className={styles.muteBtn} onClick={() => setMuted((m) => !m)}>
                        {muted ? 'Muted' : 'Sound'}
                      </button>
                    </div>

                    <div className={styles.overlayBottom}>
                      <div className={styles.meta}>
                        <div className={styles.authorRow}>
                          <span className={styles.avatar} aria-hidden>
                            {authorPicture ? (
                              <img src={authorPicture} alt="" className={styles.avatarImg} />
                            ) : (
                              (author || 'U').slice(0, 1).toUpperCase()
                            )}
                          </span>
                          <span className={styles.authorName}>@{author}</span>
                          {!isOwn && authorId && (
                            <button
                              type="button"
                              className={`${styles.followBtn} ${isFollowing ? styles.following : ''}`}
                              onClick={() => toggleFollow(authorId)}
                              disabled={!!busy}
                            >
                              {busy === `follow:${String(authorId)}` ? '…' : isFollowing ? 'Following' : 'Follow'}
                            </button>
                          )}
                        </div>
                        {reel.content && <p className={styles.caption}>{reel.content}</p>}
                      </div>

                      <div className={styles.actions}>
                        <button
                          type="button"
                          className={`${styles.actionBtn} ${liked ? styles.actionBtnActive : ''}`}
                          onClick={() => toggleLike(reel)}
                          disabled={!!busy}
                        >
                          <span className={styles.actionIcon}>{liked ? '♥' : '♡'}</span>
                          <span className={styles.actionCount}>{reel.likes || ''}</span>
                        </button>

                        <button
                          type="button"
                          className={styles.actionBtn}
                          onClick={() => {
                            setCommentsOpenFor(reel._id)
                            setCommentsOpenAuthorId(authorId ? String(authorId) : null)
                          }}
                          disabled={!!busy}
                        >
                          <span className={styles.actionIcon}>💬</span>
                          <span className={styles.actionCount}>{reel.commentsCount || ''}</span>
                        </button>

                        <button
                          type="button"
                          className={styles.actionBtn}
                          onClick={() => share(reel)}
                          disabled={!!busy}
                        >
                          <span className={styles.actionIcon}>↗</span>
                          <span className={styles.actionCount}>{reel.sharesCount || ''}</span>
                        </button>
                      </div>
                    </div>

                    {idx === activeIdx && (
                      <div className={styles.activeHint} aria-hidden>
                        {muted ? 'Tap for play/pause · Sound is muted' : 'Tap for play/pause'}
                      </div>
                    )}
                    </article>
                  )
                })}

                {token && loading && <div className={styles.loadingMore}>Loading…</div>}
              </section>
            </div>
          </>
        )}
      </main>

      <ReelCommentsSheet
        open={!!commentsOpenFor}
        onClose={() => {
          setCommentsOpenFor(null)
          setCommentsOpenAuthorId(null)
        }}
        postId={commentsOpenFor}
        postAuthorId={commentsOpenAuthorId}
        onPostUpdated={(updated) => {
          if (!updated?._id) return
          setReels((prev) =>
            prev.map((r) =>
              String(r._id) === String(updated._id)
                ? {
                    ...r,
                    commentsCount: updated.commentsCount,
                    likes: updated.likes,
                    likedBy: updated.likedBy || [],
                    sharesCount: updated.sharesCount,
                  }
                : r
            )
          )
        }}
      />
    </div>
  )
}
