import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import axios from 'axios'
import { useNavigate, useParams } from 'react-router-dom'
import styles from './Profile.module.css'
import HeaderNav from '../components/navs/HeaderNav'
import { serverUrl } from '../../config.mjs'
import FollowListModal from '../components/followList/FollowListModal'
import PostButtons from '../components/postButtons/PostButtons'

export default function Profile() {
  const navigate = useNavigate()
  const { userId: routeUserId, username: routeUsername } = useParams()
  const token = useMemo(() => localStorage.getItem('token'), [])
  const currentUserId = localStorage.getItem('userId') || ''
  const isOwnProfile = String(routeUserId) === String(currentUserId)

  const [user, setUser] = useState(null)
  /** Public profile when viewing someone else */
  const [publicProfile, setPublicProfile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [isEditing, setIsEditing] = useState(false)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [followBusy, setFollowBusy] = useState(false)
  
  const [menuOpen, setMenuOpen] = useState(false)
  const [photoModal, setPhotoModal] = useState(null)
  const photoInputRef = useRef(null)
  const coverInputRef = useRef(null)

  const [listModal, setListModal] = useState(null)
  
  // User Posts
  const [posts, setPosts] = useState([])
  const [postsLoading, setPostsLoading] = useState(false)

  // Suggestions
  const [suggestions, setSuggestions] = useState([])

  const [form, setForm] = useState({
    username: '',
    bio: '',
    address: '',
    education: '',
    dob: '',
    gender: '',
    maritalStatus: '',
    occupation: '',
  })

  // We still keep real edits for email/phone if desired, but we hide them from purely public view.
  const [privateForm, setPrivateForm] = useState({
    email: '',
    phoneNumber: ''
  })

  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token])

  const loadProfileAndPosts = useCallback(async () => {
    if (!routeUserId) return
    setLoading(true)
    setError('')
    try {
      let isFollowingCurrentUser = false
      let ids = []

      if (isOwnProfile) {
        const res = await axios.get(`${serverUrl}/profile`, { headers: authHeaders })
        setUser(res.data?.user || null)
        setPublicProfile(null)
        ids = res.data?.user?.followingIds || []
      } else {
        const res = await axios.get(`${serverUrl}/users/${routeUserId}`, { headers: authHeaders })
        setPublicProfile(res.data?.profile || null)
        setUser(null)
        
        // Need our own following set to filter suggestions properly. 
        const myRes = await axios.get(`${serverUrl}/profile`, { headers: authHeaders })
        ids = myRes.data?.user?.followingIds || []
        isFollowingCurrentUser = res.data?.profile?.isFollowing
      }

      // Fetch posts for this user
      setPostsLoading(true)
      const postsRes = await axios.get(`${serverUrl}/posts/${routeUserId}`, { headers: authHeaders })
      setPosts(postsRes.data?.posts || [])
      setPostsLoading(false)

      // Fetch suggestions
      const usersRes = await axios.get(`${serverUrl}/users?limit=20`, { headers: authHeaders })
      const idSet = new Set(ids.map(String))
      const rawUsers = usersRes.data?.users || []
      
      const filtered = rawUsers.filter(u => 
        String(u._id) !== currentUserId && !idSet.has(String(u._id))
      )
      
      setSuggestions(filtered.slice(0, 8)) // Grab up to 8

    } catch (err) {
      setPostsLoading(false)
      const msg = err?.response?.data?.message || 'Failed to load profile.'
      setError(msg)
      setUser(null)
      setPublicProfile(null)
      if (err?.response?.status === 401) navigate('/login', { replace: true })
    } finally {
      setLoading(false)
    }
  }, [routeUserId, isOwnProfile, authHeaders, navigate, currentUserId])

  useEffect(() => {
    if (!token) {
      navigate('/login', { replace: true })
      return
    }
    loadProfileAndPosts()
  }, [token, navigate, loadProfileAndPosts])

  useEffect(() => {
    const handleEsc = (e) => {
        if (e.key === 'Escape') setPhotoModal(null)
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [])

  useEffect(() => {
    const src = isOwnProfile ? user : null
    if (!src) return
    const addressString =
      typeof src.address === 'string' ? src.address : src.address?.street || ''

    const educationString = Array.isArray(src.education)
      ? src.education.join(', ')
      : src.education || ''

    const dobString = src.dob ? new Date(src.dob).toISOString().slice(0, 10) : ''

    setForm({
      username: src.username || '',
      bio: src.bio || '',
      address: addressString,
      education: educationString,
      dob: dobString,
      gender: src.gender || '',
      maritalStatus: src.maritalStatus || '',
      occupation: src.occupation || '',
    })

    setPrivateForm({
      email: src.email || '',
      phoneNumber: src.phoneNumber || ''
    })
  }, [user, isOwnProfile])

  const displayName = isOwnProfile ? user?.username : publicProfile?.username
  const displayBio = isOwnProfile ? user?.bio : publicProfile?.bio
  const displayOccupation = isOwnProfile ? user?.occupation : publicProfile?.occupation
  const displayPicture = isOwnProfile ? user?.profilePicture : publicProfile?.profilePicture
  const displayCover = isOwnProfile ? user?.coverImage : publicProfile?.coverImage

  const followersCount = isOwnProfile
    ? user?.followersCount ?? 0
    : publicProfile?.followersCount ?? 0
  const followingCount = isOwnProfile
    ? user?.followingCount ?? 0
    : publicProfile?.followingCount ?? 0
  const isFollowing = !isOwnProfile && !!publicProfile?.isFollowing

  const avatarText = useMemo(() => {
    const name = displayName || ''
    return name ? name.trim().slice(0, 1).toUpperCase() : 'U'
  }, [displayName])

  const navigateToProfile = (id, username) => {
    if (id && username) navigate(`/${id}/${username}/profile`)
  }

  const handleFollowToggle = async () => {
    if (!routeUserId || followBusy || isOwnProfile) return
    if (isFollowing) return // Clean UI requirement: don't show unfollow or do anything if already following
    
    setFollowBusy(true)
    try {
      const res = await axios.post(
        `${serverUrl}/follow`,
        { followingUserId: routeUserId },
        { headers: { ...authHeaders, 'Content-Type': 'application/json' } }
      )
      const fc = res.data?.followersCount
      setPublicProfile((prev) =>
        prev
          ? {
              ...prev,
              isFollowing: true,
              followersCount: typeof fc === 'number' ? fc : (prev.followersCount || 0) + 1,
            }
          : prev
      )
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not update follow.')
    } finally {
      setFollowBusy(false)
    }
  }

  const handleSuggFollow = async (authorId) => {
      const idStr = String(authorId)
      try {
        await axios.post(
            `${serverUrl}/follow`,
            { followingUserId: idStr },
            { headers: { ...authHeaders, 'Content-Type': 'application/json' } }
        )
        setSuggestions(prev => prev.filter(u => String(u._id) !== idStr))
      } catch (err) {
        console.error('Failed to follow', err)
      }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitLoading(true)
    setSubmitError('')
    try {
      const formData = new FormData()
      formData.append('username', form.username)
      formData.append('email', privateForm.email)
      formData.append('phoneNumber', privateForm.phoneNumber)
      formData.append('bio', form.bio)
      formData.append('address', form.address)
      formData.append('education', form.education)
      formData.append('dob', form.dob)
      formData.append('gender', form.gender)
      formData.append('maritalStatus', form.maritalStatus)
      formData.append('occupation', form.occupation)

      await axios.put(`${serverUrl}/profile`, formData, {
        headers: { Authorization: `Bearer ${token}` },
      })

      setIsEditing(false)
      await loadProfileAndPosts()
    } catch (err) {
      setSubmitError(err?.response?.data?.message || 'Profile update failed.')
      if (err?.response?.status === 401) navigate('/login', { replace: true })
    } finally {
      setSubmitLoading(false)
    }
  }

  const handlePhotoUpload = async (e, type) => {
    const file = e.target.files?.[0]
    if (!file) return
    setMenuOpen(false)
    setSubmitLoading(true)
    try {
      const formData = new FormData()
      if (type === 'profile') formData.append('profilePicture', file)
      if (type === 'cover') formData.append('coverImage', file)
      
      await axios.put(`${serverUrl}/profile`, formData, {
        headers: { Authorization: `Bearer ${token}` },
      })
      await loadProfileAndPosts()
    } catch (err) {
      console.error(err)
      setError(`Failed to update ${type} image.`)
    } finally {
      setSubmitLoading(false)
      if (e.target) e.target.value = ''
    }
  }

  const handleDeletePhoto = async (type) => {
    if (!token) return
    setPhotoModal(null)
    setSubmitLoading(true)
    try {
      const formData = new FormData()
      if (type === 'profile') formData.append('deleteProfilePicture', 'true')
      if (type === 'cover') formData.append('deleteCoverImage', 'true')
      
      await axios.put(`${serverUrl}/profile`, formData, {
        headers: { Authorization: `Bearer ${token}` },
      })
      await loadProfileAndPosts()
    } catch (err) {
      console.error(err)
      setError(`Failed to delete ${type} image.`)
    } finally {
      setSubmitLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('userId')
    localStorage.removeItem('username')
    navigate('/login')
  }

  const profileLoaded = isOwnProfile ? !!user : !!publicProfile

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
            }
          : p
      )
    )
  }

  const formatDate = (isoString) => {
    try {
        return new Date(isoString).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })
    } catch {
        return 'Just now'
    }
  }

  const profileLinkUrl = `${window.location.origin}/${routeUserId}/${routeUsername}/profile`
  const handleCopyLink = () => {
      navigator.clipboard.writeText(profileLinkUrl)
      alert("Profile link copied!")
  }

  return (
    <>
      <HeaderNav />
      <div className={styles.profileLayout}>
        <div className={styles.mainCol}>
            
            {/* Main Profile Header Card */}
            <div className={styles.profileCard}>
                <div className={styles.profileTop}>
                    {/* Cover Image Banner */}
                    <div className={styles.profileBanner}>
                        {displayCover ? (
                            <img 
                                src={displayCover} 
                                alt="Cover" 
                                className={`${styles.profileBannerImg} ${styles.clickableImage}`} 
                                onClick={() => setPhotoModal('cover')}
                                draggable="false"
                            />
                        ) : (
                            <div 
                                className={`${styles.profileBannerImg} ${styles.clickableImage}`} 
                                onClick={() => setPhotoModal('cover')}
                                style={{ width: '100%', height: '100%' }}
                            />
                        )}
                    </div>

                    {isOwnProfile && (
                    <>
                        <button 
                        className={styles.profileMenuBtn} 
                        onClick={() => setMenuOpen(!menuOpen)}
                        aria-label="Profile options"
                        >
                        ⋮
                        </button>
                        {menuOpen && (
                        <div className={styles.profileMenuDropdown}>
                            <button 
                            className={styles.profileMenuItem}
                            onClick={() => photoInputRef.current?.click()}
                            >
                            Change Profile Image
                            </button>
                            <button 
                            className={styles.profileMenuItem}
                            onClick={() => coverInputRef.current?.click()}
                            >
                            Change Cover Image
                            </button>
                            <button 
                            className={`${styles.profileMenuItem} ${styles.profileMenuItemDanger}`}
                            onClick={handleLogout}
                            >
                            Logout
                            </button>
                        </div>
                        )}
                        <input 
                        type="file" 
                        accept="image/*" 
                        ref={photoInputRef} 
                        style={{ display: 'none' }}
                        onChange={(e) => handlePhotoUpload(e, 'profile')}
                        />
                        <input 
                        type="file" 
                        accept="image/*" 
                        ref={coverInputRef} 
                        style={{ display: 'none' }}
                        onChange={(e) => handlePhotoUpload(e, 'cover')}
                        />
                    </>
                    )}

                    <div className={styles.profileContent}>
                        {displayPicture ? (
                            <div className={`${styles.profileAvatar} ${styles.clickableImage}`} onClick={() => setPhotoModal('profile')}>
                                <img src={displayPicture} alt="Profile" className={styles.profileAvatarImg} draggable="false" />
                            </div>
                        ) : (
                            <div className={`${styles.profileAvatar} ${styles.clickableImage}`} onClick={() => setPhotoModal('profile')} aria-hidden="true">
                                {avatarText}
                            </div>
                        )}
                        
                        <div className={styles.profileHeading}>
                            <h1 className={styles.profileName}>{displayName || 'Loading...'}</h1>
                            <p className={styles.profileHandle}>@{routeUsername}</p>
                            
                            {displayOccupation && <p className={styles.profileOccupation}>{displayOccupation}</p>}
                            {displayBio && <p className={styles.profileBio}>{displayBio}</p>}
                            
                            <div className={styles.profileLinkArea}>
                                <span className={styles.profileLinkText}>{profileLinkUrl}</span>
                                <button className={styles.copyLinkBtn} onClick={handleCopyLink}>Copy</button>
                            </div>

                            {profileLoaded && (
                                <div className={styles.statsRow}>
                                    <button className={styles.statBtn} onClick={() => setListModal('followers')}>
                                        <strong>{followersCount}</strong> Followers
                                    </button>
                                    <button className={styles.statBtn} onClick={() => setListModal('following')}>
                                        <strong>{followingCount}</strong> Following
                                    </button>
                                </div>
                            )}

                            <div className={styles.profileActions}>
                                {!isOwnProfile && profileLoaded && !isFollowing && (
                                    <button
                                        type="button"
                                        className={styles.followBtnPrimary}
                                        onClick={handleFollowToggle}
                                        disabled={followBusy}
                                    >
                                        {followBusy ? '…' : '+ Follow'}
                                    </button>
                                )}

                                {isOwnProfile && profileLoaded && (
                                    <button
                                        type="button"
                                        className={styles.editButton}
                                        onClick={() => {
                                            setSubmitError('')
                                            setIsEditing(true)
                                        }}
                                    >
                                        Edit profile
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {loading && <div className={styles.loading}>Loading profile…</div>}
            {!loading && error && <div className={styles.error}>{error}</div>}

            {/* Editing / Details Block */}
            {!loading && !error && profileLoaded && isEditing && isOwnProfile && (
                <div className={styles.cardBase}>
                    <form className={styles.editForm} onSubmit={handleSubmit}>
                        <h3 className={styles.detailsHeading}>Edit Profile Details</h3>
                        <div className={styles.editGrid}>
                            <label className={styles.field}>
                                <span className={styles.fieldLabel}>Username</span>
                                <input
                                    className={styles.fieldInput}
                                    value={form.username}
                                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                                    required
                                />
                            </label>

                            <label className={styles.field}>
                                <span className={styles.fieldLabel}>Bio</span>
                                <textarea
                                    className={styles.fieldInput}
                                    value={form.bio}
                                    onChange={(e) => setForm({ ...form, bio: e.target.value })}
                                    rows={3}
                                />
                            </label>

                            <label className={styles.field}>
                                <span className={styles.fieldLabel}>Occupation</span>
                                <input
                                    className={styles.fieldInput}
                                    value={form.occupation}
                                    onChange={(e) => setForm({ ...form, occupation: e.target.value })}
                                />
                            </label>

                            <label className={styles.field}>
                                <span className={styles.fieldLabel}>Education</span>
                                <input
                                    className={styles.fieldInput}
                                    value={form.education}
                                    onChange={(e) => setForm({ ...form, education: e.target.value })}
                                />
                            </label>

                            {/* Keep private details in DB but don't show to public */}
                            <label className={styles.field}>
                                <span className={styles.fieldLabel}>Private Phone Number</span>
                                <input
                                    className={styles.fieldInput}
                                    value={privateForm.phoneNumber}
                                    onChange={(e) => setPrivateForm({ ...privateForm, phoneNumber: e.target.value })}
                                />
                            </label>

                            <label className={styles.field}>
                                <span className={styles.fieldLabel}>Private Email</span>
                                <input
                                    className={styles.fieldInput}
                                    value={privateForm.email}
                                    type="email"
                                    required
                                    onChange={(e) => setPrivateForm({ ...privateForm, email: e.target.value })}
                                />
                            </label>
                        </div>

                        {submitError && <div className={styles.submitError}>{submitError}</div>}

                        <div className={styles.editActions}>
                            <button
                                type="button"
                                className={styles.cancelButton}
                                onClick={() => {
                                    setSubmitError('')
                                    setIsEditing(false)
                                }}
                                disabled={submitLoading}
                            >
                                Cancel
                            </button>
                            <button type="submit" className={styles.saveButton} disabled={submitLoading}>
                                {submitLoading ? 'Saving...' : 'Save'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {!loading && !error && profileLoaded && !isEditing && (
                <div className={`${styles.cardBase} ${styles.profileDetailsCard}`}>
                    <h3 className={styles.detailsHeading}>Additional Details</h3>
                    <div className={styles.profileGrid}>
                        <div className={styles.profileItem}>
                            <div className={styles.profileLabel}>Education</div>
                            <div className={styles.profileValue}>{
                                isOwnProfile ? (Array.isArray(user?.education) ? user.education.join(', ') : user?.education) 
                                : (Array.isArray(publicProfile?.education) ? publicProfile.education.join(', ') : publicProfile?.education) || '—'
                            }</div>
                        </div>
                        {/* Expandable down the line if address/dob etc should be public */}
                    </div>
                </div>
            )}

            {/* User Posts Section */}
            {profileLoaded && (
                <>
                    {postsLoading && <div className={styles.loading}>Loading posts...</div>}
                    {!postsLoading && posts.length === 0 && (
                        <div className={styles.loading}>No posts to show.</div>
                    )}
                    {!postsLoading && posts.length > 0 && (
                        <div className={styles.feedList}>
                            {posts.map(post => {
                                const postMediaType = String(post?.mediaType || '')
                                return (
                                    <article className={styles.feedCard} key={post._id}>
                                        <div className={styles.cardHeader}>
                                            <div className={styles.authorBlock} onClick={() => navigateToProfile(routeUserId, displayName)}>
                                                <span className={styles.miniAvatar} aria-hidden>
                                                    {displayPicture ? (
                                                        <img src={displayPicture} alt="" />
                                                    ) : (
                                                        (displayName || 'U').slice(0, 1).toUpperCase()
                                                    )}
                                                </span>
                                                <div>
                                                    <p className={styles.authorName}>{displayName}</p>
                                                    <p className={styles.postTime}>{formatDate(post.createdAt)}</p>
                                                </div>
                                            </div>
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
                                            postAuthorId={routeUserId}
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
                </>
            )}
        </div>

        {/* Suggested For You - Right Side Sticky */}
        <div className={styles.rightCol}>
            <div className={styles.suggestCard}>
                <h3 className={styles.suggestTitle}>Suggested for you</h3>
                <div className={styles.suggestionList}>
                    {suggestions.length === 0 ? (
                        <div className={styles.loading} style={{padding: '0 0 8px'}}>No suggestions</div>
                    ) : (
                        suggestions.map(sugg => (
                            <div key={sugg._id} className={styles.suggestionItem}>
                                <div 
                                    className={styles.miniAvatar} 
                                    style={{width: 36, height: 36, cursor: 'pointer'}}
                                    onClick={() => navigateToProfile(sugg._id, sugg.username)}
                                >
                                    {sugg.profilePicture ? (
                                        <img src={sugg.profilePicture} alt="" />
                                    ) : (
                                        (sugg.username || 'U').slice(0, 1).toUpperCase()
                                    )}
                                </div>
                                <div className={styles.suggestionInfo}>
                                    <div 
                                        className={styles.suggestionName}
                                        onClick={() => navigateToProfile(sugg._id, sugg.username)}
                                    >
                                        {sugg.username}
                                    </div>
                                    <div className={styles.suggestionDesc}>{sugg.occupation || 'Member'}</div>
                                </div>
                                <button
                                    type="button"
                                    className={styles.suggFollowBtn}
                                    onClick={() => handleSuggFollow(sugg._id)}
                                    title="Follow"
                                >
                                    +
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
      </div>

      <FollowListModal
        open={listModal === 'followers'}
        onClose={() => setListModal(null)}
        userId={routeUserId}
        variant="followers"
        title="Followers"
      />
      <FollowListModal
        open={listModal === 'following'}
        onClose={() => setListModal(null)}
        userId={routeUserId}
        variant="following"
        title="Following"
      />

      {photoModal && (
        <div className={styles.photoModalOverlay} onClick={() => setPhotoModal(null)} role="dialog" aria-modal="true">
          <div className={styles.photoModalContent} onClick={(e) => e.stopPropagation()}>
            <button className={styles.photoModalClose} onClick={() => setPhotoModal(null)} aria-label="Close modal">×</button>
            <div className={styles.photoModalHeader}>
              {photoModal === 'profile' ? 'Profile Photo' : 'Cover Photo'}
            </div>
            <div className={styles.photoModalImageWrap}>
              {photoModal === 'profile' ? (
                 displayPicture ? (
                   <img src={displayPicture} alt="Profile" className={styles.photoModalImg} draggable="false" />
                 ) : (
                   <div className={styles.photoModalAvatarText}>{avatarText}</div>
                 )
              ) : (
                 displayCover ? (
                   <img src={displayCover} alt="Cover" className={styles.photoModalImg} draggable="false" />
                 ) : (
                   <div className={styles.photoModalCoverPlaceholder}>No cover image</div>
                 )
              )}
            </div>
            
            {isOwnProfile && (
              <div className={styles.photoModalActions}>
                <button 
                  type="button"
                  className={styles.modalActionBtn} 
                  onClick={() => {
                    setPhotoModal(null)
                    if (photoModal === 'profile') photoInputRef.current?.click()
                    else coverInputRef.current?.click()
                  }}
                >
                  Update
                </button>
                {((photoModal === 'profile' && displayPicture) || (photoModal === 'cover' && displayCover)) && (
                  <button 
                    type="button"
                    className={`${styles.modalActionBtn} ${styles.modalActionBtnDanger}`} 
                    onClick={() => handleDeletePhoto(photoModal)}
                  >
                    Delete
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
