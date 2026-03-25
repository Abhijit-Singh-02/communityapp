import React, { useEffect, useMemo, useState } from 'react'
import HeaderNav from '../components/navs/HeaderNav'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { serverUrl } from '../../config.mjs'
import styles from './Home.module.css'
import PostButtons from '../components/postButtons/PostButtons'
import FollowListModal from '../components/followList/FollowListModal'

export default function Home() {
    const navigate = useNavigate()
    const token = localStorage.getItem('token')
    const currentUsername = localStorage.getItem('username') || ''
    const currentUserId = localStorage.getItem('userId') || ''

    const [posts, setPosts] = useState([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    
    // Current user data for left sidebar
    const [currentUser, setCurrentUser] = useState(null)
    const [followingIds, setFollowingIds] = useState(() => new Set())
    
    // Followers Modal Interaction
    const [listModal, setListModal] = useState(null)

    const sortedPosts = useMemo(
      () => [...posts].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
      [posts]
    )

    const recentActivities = useMemo(() => {
      // Filter recent interactions for the right side
      if (!currentUserId && !currentUser) return []
      return sortedPosts
        .filter(p => {
          const authorId = p.userId?._id ?? p.userId
          const isAuthor = String(authorId) === String(currentUserId || currentUser?._id)
          const isLiker = p.likedBy?.some(id => String(id) === String(currentUserId || currentUser?._id))
          return isAuthor || isLiker
        })
        .slice(0, 5) // Last 5 activities
    }, [sortedPosts, currentUserId, currentUser])

    useEffect(() => {
        if (!token) {
            navigate('/login', { replace: true })
            return
        }

        const fetchFeedData = async () => {
          setLoading(true)
          setError('')
          try {
            // Fetch posts
            const postsRes = await axios.get(`${serverUrl}/posts`, {
              headers: { Authorization: `Bearer ${token}` },
            })
            setPosts(postsRes.data?.posts || [])
            
            // Fetch profile (for sidebar and following logic)
            const profileRes = await axios.get(`${serverUrl}/profile`, {
              headers: { Authorization: `Bearer ${token}` },
            })
            setCurrentUser(profileRes.data?.user || null)
            const ids = profileRes.data?.user?.followingIds || []
            setFollowingIds(new Set(ids.map(String)))

          } catch (err) {
            if (err?.response?.status === 401) navigate('/login', { replace: true })
            setError(err?.response?.data?.message || 'Unable to load feed.')
          } finally {
            setLoading(false)
          }
        }

        fetchFeedData()
    }, [navigate, token])

    const formatDate = (isoString) => {
      try {
        return new Date(isoString).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })
      } catch {
        return 'Just now'
      }
    }

    const toggleFollow = async (authorId, authorName) => {
      if (!authorId || !token) return
      if (authorName === currentUsername) return
      const idStr = String(authorId)
      // Hide follow button based on logic - we don't need unfollow on the home page feed
      try {
        await axios.post(
          `${serverUrl}/follow`,
          { followingUserId: idStr },
          { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
        )
        setFollowingIds((prev) => new Set([...prev, idStr]))
        if (currentUser) {
          setCurrentUser({...currentUser, followingCount: (currentUser.followingCount || 0) + 1})
        }
      } catch (err) {
        setError(err?.response?.data?.message || 'Could not update follow.')
      }
    }

    const handlePostUpdated = (updated) => {
      if (!updated?._id) return
      setPosts((prev) =>
        prev.map((p) =>
          String(p._id) === String(updated._id)
            ? {
                ...p,
                likes: updated.likes,
                likedBy: updated.likedBy || [],
                commentsCount: updated.commentsCount,
                sharesCount: updated.sharesCount,
                comments: updated.comments,
              }
            : p
        )
      )
    }

    const navigateToProfile = (id, username) => {
        if (id && username) {
            navigate(`/${id}/${username}/profile`)
        }
    }

  return (
    <div className={styles.homePage}>
        <HeaderNav />
        <div className={styles.mainLayout}>
          
          {/* LEFT SIDEBAR: User Profile Card Only */}
          <aside className={styles.leftSidebar}>
            <div className={`${styles.card} ${styles.profileCard}`}>
              <div className={styles.profileHero} />
              <div className={styles.profileInfo}>
                <div 
                    className={styles.profileAvatar} 
                    onClick={() => navigateToProfile(currentUser?._id, currentUser?.username)}
                    style={{cursor: 'pointer'}}
                >
                  {currentUser?.profilePicture ? (
                    <img src={currentUser.profilePicture} alt="Profile" />
                  ) : (
                    (currentUser?.username || currentUsername || 'U').slice(0, 1).toUpperCase()
                  )}
                </div>
                <h3 
                    className={styles.profileName}
                    onClick={() => navigateToProfile(currentUser?._id, currentUser?.username)}
                    style={{cursor: 'pointer'}}
                >
                    {currentUser?.username || currentUsername}
                </h3>
                <p className={styles.profileHandle}>{currentUser?.occupation || 'Member'}</p>
                
                <div className={styles.profileStats}>
                  <div className={styles.stat} onClick={() => setListModal('followers')} title="View followers">
                    <span className={styles.statValue}>{currentUser?.followersCount || 0}</span>
                    <span className={styles.statLabel}>Followers</span>
                  </div>
                  <div className={styles.stat} onClick={() => setListModal('following')} title="View following">
                    <span className={styles.statValue}>{currentUser?.followingCount || 0}</span>
                    <span className={styles.statLabel}>Following</span>
                  </div>
                </div>
              </div>
            </div>
          </aside>

          {/* CENTER FEED: Only Posts */}
          <main className={styles.feedContainer}>
            {loading && <div className={styles.placeholder}>Loading feed...</div>}
            {!loading && error && <div className={styles.error}>{error}</div>}
            {!loading && !error && sortedPosts.length === 0 && (
              <div className={styles.placeholder}>No posts yet. Follow people to see updates!</div>
            )}

            {!loading && !error && sortedPosts.length > 0 && (
              <div className={styles.feedList}>
                {sortedPosts.map((post) => {
                  const author = post?.userId?.username || 'Unknown'
                  const authorId = post?.userId?._id ?? post?.userId
                  const isOwnPost = author === currentUsername
                  const isFollowed = authorId && followingIds.has(String(authorId))
                  const postMediaType = String(post?.mediaType || '')

                  return (
                    <article className={`${styles.card} ${styles.feedCard}`} key={post._id}>
                      <div className={styles.cardHeader}>
                        <div 
                            className={styles.authorBlock} 
                            onClick={() => navigateToProfile(authorId, author)}
                        >
                          <span className={styles.miniAvatar} aria-hidden>
                            {post?.userId?.profilePicture ? (
                              <img src={post.userId.profilePicture} alt="" />
                            ) : (
                              (author || 'U').slice(0, 1).toUpperCase()
                            )}
                          </span>
                          <div>
                            <p className={styles.authorName}>{author}</p>
                            <p className={styles.postMeta}>{formatDate(post.createdAt)}</p>
                          </div>
                        </div>
                        {/* Only show Follow button if NOT following */}
                        {!isOwnPost && authorId && !isFollowed && (
                          <button
                            type="button"
                            className={styles.followBtn}
                            onClick={() => toggleFollow(authorId, author)}
                          >
                            + Follow
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
                      <PostButtons
                        postId={post._id}
                        postAuthorId={post?.userId?._id ?? post?.userId}
                        likes={post.likes}
                        commentsCount={post.commentsCount}
                        sharesCount={post.sharesCount}
                        likedBy={post.likedBy || []}
                        onUpdated={handlePostUpdated}
                      />
                    </article>
                  )
                })}
              </div>
            )}
          </main>

          {/* RIGHT SIDEBAR: Recent Activities */}
          <aside className={styles.rightSidebar}>
            <div className={styles.card}>
                <div className={styles.activityHeader}>Recent Activities</div>
                <div className={styles.activityList}>
                    {recentActivities.length === 0 ? (
                        <div className={styles.activityItem} style={{textAlign: 'center', cursor: 'default'}}>
                            No recent activity
                        </div>
                    ) : (
                        recentActivities.map(post => {
                            const authorId = post.userId?._id ?? post.userId
                            const isAuthor = String(authorId) === String(currentUserId || currentUser?._id)
                            
                            let actionText = 'Interacted with'
                            if (isAuthor) actionText = 'Posted'
                            else if (post.likedBy?.some(id => String(id) === String(currentUserId || currentUser?._id))) {
                                actionText = 'Liked a post'
                            }

                            return (
                                <div key={post._id} className={styles.activityItem}>
                                    <b>{actionText}:</b> "{post.content?.slice(0, 30)}{post.content?.length > 30 ? '...' : ''}"
                                </div>
                            )
                        })
                    )}
                </div>
            </div>
          </aside>

        </div>
        
        {/* Followers/Following Modal */}
        <FollowListModal
          open={!!listModal}
          onClose={() => setListModal(null)}
          userId={currentUserId || currentUser?._id}
          variant={listModal}
          title={listModal === 'followers' ? 'Followers' : 'Following'}
        />
    </div>
  )
}
