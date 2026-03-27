import React, { useEffect, useRef, useState } from 'react'
import axios from 'axios'
import styles from './Posts.module.css'
import HeaderNav from '../components/navs/HeaderNav'
import { useNavigate } from 'react-router-dom'
import { serverUrl } from '../../config.mjs'
import PostButtons from '../components/postButtons/PostButtons'

export default function Posts() {
  const navigate = useNavigate()
  const token = localStorage.getItem('token')

  const [composerMode, setComposerMode] = useState('post') // 'post' | 'job'
  const [content, setContent] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [jobCompany, setJobCompany] = useState('')
  const [jobLocation, setJobLocation] = useState('')
  const [jobEmploymentType, setJobEmploymentType] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [posts, setPosts] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [deletingPostId, setDeletingPostId] = useState(null)
  const composerRef = useRef(null)

  useEffect(() => {
    if (!token) {
      navigate('/login', { replace: true })
      return
    }
    const fetchPosts = async () => {
      setLoading(true)
      let userId = localStorage.getItem('userId');
      try {
        const res = await axios.get(`${serverUrl}/posts/${userId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const backendPosts = (res.data?.posts || []).map((post) => ({
          id: post._id,
          authorId: post.userId?._id ?? post.userId,
          author: post.userId?.username || 'Unknown',
          authorPicture: post.userId?.profilePicture || '',
          createdAt: post.createdAt,
          postType: post.postType || 'post',
          text: post.content || '',
          job: post.job || null,
          mediaType: post.mediaType || '',
          mediaName: '',
          mediaPreview: post.media || '',
          likes: post.likes || 0,
          likedBy: post.likedBy || [],
          commentsCount: post.commentsCount || 0,
          sharesCount: post.sharesCount || 0,
          isLiked: false,
        }))
        setPosts(backendPosts)
      } catch (err) {
        if (err?.response?.status === 401) navigate('/login', { replace: true })
        setError(err?.response?.data?.message || 'Failed to fetch posts.')
      } finally {
        setLoading(false)
      }
    }
    fetchPosts()
  }, [navigate, token])

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl('')
      return
    }
    const objectUrl = URL.createObjectURL(selectedFile)
    setPreviewUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [selectedFile])

  const handleCreatePost = async (e) => {
    e.preventDefault()
    setError('')

    const trimmedContent = content.trim()
    if (composerMode === 'job') {
      if (!jobTitle.trim() || !trimmedContent) {
        setError('Job title and description are required.')
        return
      }
    } else if (!trimmedContent && !selectedFile) {
      setError('Write something or attach media before posting.')
      return
    }

    try {
      setSubmitLoading(true)
      const formData = new FormData()
      formData.append('postType', composerMode)
      if (composerMode === 'job') {
        formData.append('jobTitle', jobTitle.trim())
        formData.append('company', jobCompany.trim())
        formData.append('jobLocation', jobLocation.trim())
        formData.append('employmentType', jobEmploymentType.trim())
      }
      formData.append('content', trimmedContent)
      if (composerMode !== 'job' && selectedFile) {
        formData.append('mediaFile', selectedFile)
        if (selectedFile.type.startsWith('image/')) formData.append('mediaType', 'image')
        else if (selectedFile.type.startsWith('video/')) formData.append('mediaType', 'video')
      } else if (composerMode !== 'job') {
        formData.append('mediaType', 'text')
      }

      const res = await axios.post(`${serverUrl}/posts`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const created = res.data?.post
      if (created) {
        const nextPost = {
          id: created._id,
          authorId: created.userId?._id ?? created.userId ?? localStorage.getItem('userId'),
          author: localStorage.getItem('username') || 'You',
          authorPicture: created.userId?.profilePicture || '',
          createdAt: created.createdAt || new Date().toISOString(),
          postType: created.postType || composerMode,
          text: created.content || '',
          job: created.job || null,
          mediaType: created.mediaType || '',
          mediaName: '',
          mediaPreview: created.media || '',
          likes: created.likes || 0,
          likedBy: created.likedBy || [],
          commentsCount: created.commentsCount || 0,
          sharesCount: created.sharesCount || 0,
          isLiked: false,
        }
        setPosts((prev) => [nextPost, ...prev])
      }

      setContent('')
      setJobTitle('')
      setJobCompany('')
      setJobLocation('')
      setJobEmploymentType('')
      setSelectedFile(null)
      setPreviewUrl('')
    } catch (err) {
      if (err?.response?.status === 401) navigate('/login', { replace: true })
      setError(err?.response?.data?.message || 'Unable to create post.')
    } finally {
      setSubmitLoading(false)
    }
  }

  const handleCancelPost = () => {
    setComposerMode('post')
    setContent('')
    setJobTitle('')
    setJobCompany('')
    setJobLocation('')
    setJobEmploymentType('')
    setSelectedFile(null)
    setPreviewUrl('')
    setError('')
  }

  const applyFormat = (type) => {
    const textarea = composerRef.current
    if (!textarea) return
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selected = content.slice(start, end)
    let replacement = selected

    if (type === 'bold') replacement = `**${selected || 'bold text'}**`
    if (type === 'italic') replacement = `*${selected || 'italic text'}*`
    if (type === 'heading') replacement = `## ${selected || 'Heading'}`
    if (type === 'quote') replacement = `> ${selected || 'Quote'}`
    if (type === 'bullet') replacement = `- ${selected || 'List item'}`
    if (type === 'code') replacement = `\`${selected || 'code'}\``

    const next = `${content.slice(0, start)}${replacement}${content.slice(end)}`
    setContent(next)

    requestAnimationFrame(() => {
      textarea.focus()
      const cursor = start + replacement.length
      textarea.setSelectionRange(cursor, cursor)
    })
  }

  const renderInlineFormatting = (line) => {
    const parts = []
    let index = 0
    const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g
    let match = pattern.exec(line)
    while (match) {
      const [token] = match
      const start = match.index
      if (start > index) parts.push(<span key={`${start}-plain`}>{line.slice(index, start)}</span>)

      if (token.startsWith('**')) {
        parts.push(<strong key={`${start}-bold`}>{token.slice(2, -2)}</strong>)
      } else if (token.startsWith('*')) {
        parts.push(<em key={`${start}-italic`}>{token.slice(1, -1)}</em>)
      } else {
        parts.push(<code key={`${start}-code`} className={styles.inlineCode}>{token.slice(1, -1)}</code>)
      }

      index = start + token.length
      match = pattern.exec(line)
    }
    if (index < line.length) parts.push(<span key={`${index}-tail`}>{line.slice(index)}</span>)
    return parts
  }

  const renderFormattedText = (text) => {
    const lines = text.split('\n')
    return lines.map((line, idx) => {
      const key = `line-${idx}`
      if (line.startsWith('## ')) return <h4 key={key} className={styles.postHeading}>{line.slice(3)}</h4>
      if (line.startsWith('> ')) return <blockquote key={key} className={styles.postQuote}>{line.slice(2)}</blockquote>
      if (line.startsWith('- ')) return <p key={key} className={styles.postListItem}>• {renderInlineFormatting(line.slice(2))}</p>
      return <p key={key} className={styles.postLine}>{renderInlineFormatting(line)}</p>
    })
  }

  const handlePostUpdatedFromButtons = (updated) => {
    if (!updated?._id) return
    setPosts((prev) =>
      prev.map((post) =>
        String(post.id) === String(updated._id)
          ? {
              ...post,
              likes: updated.likes,
              likedBy: updated.likedBy || [],
              commentsCount: updated.commentsCount,
              sharesCount: updated.sharesCount,
            }
          : post
      )
    )
  }

  const deletePost = async (postId) => {
    if (!postId || !token) return
    if (!window.confirm('Delete this post permanently? This cannot be undone.')) return
    setError('')
    setDeletingPostId(postId)
    try {
      await axios.delete(`${serverUrl}/posts/${postId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      setPosts((prev) => prev.filter((post) => String(post.id) !== String(postId)))
    } catch (err) {
      if (err?.response?.status === 401) navigate('/login', { replace: true })
      setError(err?.response?.data?.message || 'Failed to delete post.')
    } finally {
      setDeletingPostId(null)
    }
  }

  const formatDate = (isoString) => {
    try {
      return new Date(isoString).toLocaleString()
    } catch {
      return 'Just now'
    }
  }

  return (
    <div className={styles.postsPage}>
        <HeaderNav />
        <div className={styles.postsContainer}>
          <section className={styles.postComposerCard}>
            <div className={styles.composerHeader}>
              <h2 className={styles.sectionTitle}>{composerMode === 'job' ? 'Post a Job' : 'Create Post'}</h2>
              <div className={styles.modeTabs}>
                <button
                  type="button"
                  className={`${styles.modeTab} ${composerMode === 'post' ? styles.modeTabActive : ''}`}
                  onClick={() => setComposerMode('post')}
                  disabled={submitLoading}
                >
                  Post
                </button>
                <button
                  type="button"
                  className={`${styles.modeTab} ${composerMode === 'job' ? styles.modeTabActive : ''}`}
                  onClick={() => setComposerMode('job')}
                  disabled={submitLoading}
                >
                  Job
                </button>
              </div>
            </div>
            <form className={styles.postForm} onSubmit={handleCreatePost}>
              {composerMode !== 'job' && (
                <div className={styles.formatBar}>
                <button type="button" className={styles.formatBtn} onClick={() => applyFormat('bold')}>B</button>
                <button type="button" className={styles.formatBtn} onClick={() => applyFormat('italic')}>I</button>
                <button type="button" className={styles.formatBtn} onClick={() => applyFormat('heading')}>H</button>
                <button type="button" className={styles.formatBtn} onClick={() => applyFormat('quote')}>"</button>
                <button type="button" className={styles.formatBtn} onClick={() => applyFormat('bullet')}>•</button>
                <button type="button" className={styles.formatBtn} onClick={() => applyFormat('code')}>{'</>'}</button>
                </div>
              )}

              {composerMode === 'job' && (
                <div className={styles.jobFields}>
                  <input
                    className={styles.fieldInput}
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    placeholder="Job title (e.g., Frontend Developer)"
                  />
                  <div className={styles.fieldRow}>
                    <input
                      className={styles.fieldInput}
                      value={jobCompany}
                      onChange={(e) => setJobCompany(e.target.value)}
                      placeholder="Company (optional)"
                    />
                    <input
                      className={styles.fieldInput}
                      value={jobLocation}
                      onChange={(e) => setJobLocation(e.target.value)}
                      placeholder="Location (optional)"
                    />
                  </div>
                  <input
                    className={styles.fieldInput}
                    value={jobEmploymentType}
                    onChange={(e) => setJobEmploymentType(e.target.value)}
                    placeholder="Employment type (optional, e.g., Full-time)"
                  />
                  <p className={styles.jobHint}>
                    Applicants will email you at your account email address.
                  </p>
                </div>
              )}
              <textarea
                ref={composerRef}
                className={styles.postInput}
                placeholder={composerMode === 'job' ? 'Describe the role, requirements, and how to apply…' : 'Share your thoughts, project updates, or opportunities...'}
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />

              {composerMode !== 'job' && (
                <div className={styles.postOptions}>
                <label className={styles.uploadLabel}>
                  <input
                    className={styles.hiddenInput}
                    type="file"
                    accept="image/*,video/*"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  />
                  Add Image / Video
                </label>
                {selectedFile && (
                  <span className={styles.fileName} title={selectedFile.name}>
                    {selectedFile.name}
                  </span>
                )}
                </div>
              )}

              {previewUrl && (
                <div className={styles.previewWrapper}>
                  {selectedFile?.type.startsWith('video/') ? (
                    <video controls src={previewUrl} className={styles.mediaPreview} />
                  ) : (
                    <img src={previewUrl} alt="Preview" className={styles.mediaPreview} />
                  )}
                </div>
              )}

              {error && <p className={styles.errorMessage}>{error}</p>}

              <div className={styles.actionRow}>
                <button type="submit" className={styles.primaryBtn} disabled={submitLoading}>
                  {submitLoading ? 'Posting...' : 'Post'}
                </button>
                <button type="button" className={styles.secondaryBtn} onClick={handleCancelPost}>
                  Cancel
                </button>
              </div>
            </form>
          </section>

          <section className={styles.feedSection}>
            <h2 className={styles.sectionTitle}>Recent Posts</h2>
            {loading ? (
              <div className={styles.emptyState}>Loading posts...</div>
            ) : posts.length === 0 ? (
              <div className={styles.emptyState}>
                No posts yet. Create your first post to start your feed.
              </div>
            ) : (
              <div className={styles.feedList}>
                {posts.map((post) => (
                  <article key={post.id} className={styles.postCard}>
                    <div className={styles.postHeader}>
                      <div className={styles.authorBlock}>
                        <span className={styles.avatar} aria-hidden>
                          {post.authorPicture ? (
                            <img src={post.authorPicture} alt="" className={styles.avatarImg} />
                          ) : (
                            (post.author || 'U').slice(0, 1).toUpperCase()
                          )}
                        </span>
                        <div>
                          <p className={styles.authorName}>{post.author}</p>
                          <p className={styles.postTime}>{formatDate(post.createdAt)}</p>
                        </div>
                      </div>
                      {post.postType === 'job' && <span className={styles.badge}>JOB</span>}
                    </div>

                    {post.postType === 'job' && post.job?.title && (
                      <div className={styles.jobCardTop}>
                        <h3 className={styles.jobTitle}>{post.job.title}</h3>
                        {(post.job.company || post.job.location || post.job.employmentType) && (
                          <p className={styles.jobMeta}>
                            {[post.job.company, post.job.location, post.job.employmentType].filter(Boolean).join(' · ')}
                          </p>
                        )}
                      </div>
                    )}

                    {post.text && <div className={styles.postText}>{renderFormattedText(post.text)}</div>}

                    {post.postType !== 'job' && post.mediaPreview && (
                      <div className={styles.postMediaWrap}>
                        {String(post.mediaType).includes('video') ? (
                          <video controls src={post.mediaPreview} className={styles.postMedia} />
                        ) : (
                          <img src={post.mediaPreview} alt={post.mediaName || 'Post media'} className={styles.postMedia} />
                        )}
                      </div>
                    )}

                    <PostButtons
                      postId={post.id}
                      postAuthorId={post.authorId}
                      likes={post.likes}
                      commentsCount={post.commentsCount}
                      sharesCount={post.sharesCount}
                      likedBy={post.likedBy || []}
                      onUpdated={handlePostUpdatedFromButtons}
                    />
                    <div className={styles.postActions}>
                      <button
                        type="button"
                        className={styles.deleteBtn}
                        onClick={() => deletePost(post.id)}
                        disabled={deletingPostId === post.id}
                      >
                        {deletingPostId === post.id ? 'Deleting…' : 'Delete'}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
    </div>
  )
}

