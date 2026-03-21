import React, { useEffect, useMemo, useState } from 'react'
import HeaderNav from '../components/navs/HeaderNav'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { serverUrl } from '../../config.mjs'
import styles from './Home.module.css'
export default function Home() {
    const navigate = useNavigate()
    const token = localStorage.getItem('token')
    const currentUsername = localStorage.getItem('username') || ''
    const [posts, setPosts] = useState([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [followedAuthors, setFollowedAuthors] = useState({})

    const sortedPosts = useMemo(
      () => [...posts].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
      [posts]
    )

    useEffect(() => {
        if (!token) {
            navigate('/login', { replace: true })
            return
        }

        const fetchPosts = async () => {
          setLoading(true)
          setError('')
          try {
            const res = await axios.get(`${serverUrl}/posts`, {
              headers: { Authorization: `Bearer ${token}` },
            })
            setPosts(res.data?.posts || [])
          } catch (err) {
            if (err?.response?.status === 401) navigate('/login', { replace: true })
            setError(err?.response?.data?.message || 'Unable to load feed.')
          } finally {
            setLoading(false)
          }
        }

        fetchPosts()
    }, [navigate, token])

    const formatDate = (isoString) => {
      try {
        return new Date(isoString).toLocaleString()
      } catch {
        return 'Just now'
      }
    }

    const toggleFollow = (authorName) => {
      if (!authorName || authorName === currentUsername) return
      setFollowedAuthors((prev) => ({ ...prev, [authorName]: !prev[authorName] }))
    }

  return (
    <div className={styles.homePage}>
        <HeaderNav />
        <main className={styles.feedContainer}>

          {loading && <div className={styles.placeholder}>Loading posts...</div>}
          {!loading && error && <div className={styles.error}>{error}</div>}

          {!loading && !error && sortedPosts.length === 0 && (
            <div className={styles.placeholder}>No posts yet. Follow people and check back soon.</div>
          )}

          {!loading && !error && sortedPosts.length > 0 && (
            <div className={styles.feedList}>
              {sortedPosts.map((post) => {
                const author = post?.userId?.username || 'Unknown'
                const isOwnPost = author === currentUsername
                const isFollowed = !!followedAuthors[author]
                const postMediaType = String(post?.mediaType || '')

                return (
                  <article className={styles.feedCard} key={post._id}>
                    <div className={styles.cardHeader}>
                      <div>
                        <p className={styles.authorName}>{author}</p>
                        <p className={styles.postMeta}>{formatDate(post.createdAt)}</p>
                      </div>
                      {!isOwnPost && (
                        <button
                          type="button"
                          className={`${styles.followBtn} ${isFollowed ? styles.following : ''}`}
                          onClick={() => toggleFollow(author)}
                        >
                          {isFollowed ? 'Following' : 'Follow'}
                        </button>
                      )}
                    </div>

                    {post?.content && <p className={styles.postContent}>{post.content}</p>}

                    {post?.media && (
                      <div className={styles.mediaWrap}>
                        {postMediaType.includes('video') ? (
                          <video controls src={post.media} className={styles.postMedia} />
                        ) : (
                          <img src={post.media} alt="Post media" className={styles.postMedia} />
                        )}
                      </div>
                    )}
                  </article>
                )
              })}
            </div>
          )}
        </main>
    </div>
  )
}
