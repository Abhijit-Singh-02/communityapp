import React, { useEffect, useRef, useState } from 'react'
import axios from 'axios'
import styles from './Posts.module.css'
import HeaderNav from '../components/navs/HeaderNav'
import { useNavigate } from 'react-router-dom'
import { serverUrl } from '../../config.mjs'

export default function Posts() {
  const navigate = useNavigate()
  const token = localStorage.getItem('token')

  const [content, setContent] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [posts, setPosts] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitLoading, setSubmitLoading] = useState(false)
  const composerRef = useRef(null)

  useEffect(() => {
    if (!token) {
      navigate('/login', { replace: true })
      return
    }
    const fetchPosts = async () => {
      setLoading(true)
      try {
        const res = await axios.get(`${serverUrl}/posts`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const backendPosts = (res.data?.posts || []).map((post) => ({
          id: post._id,
          author: post.userId?.username || 'Unknown',
          createdAt: post.createdAt,
          text: post.content || '',
          mediaType: post.mediaType || '',
          mediaName: '',
          mediaPreview: post.media || '',
          likes: post.likes || 0,
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
    if (!trimmedContent && !selectedFile) {
      setError('Write something or attach media before posting.')
      return
    }

    try {
      setSubmitLoading(true)
      const formData = new FormData()
      formData.append('content', trimmedContent)
      if (selectedFile) {
        formData.append('mediaFile', selectedFile)
        if (selectedFile.type.startsWith('image/')) formData.append('mediaType', 'image')
        else if (selectedFile.type.startsWith('video/')) formData.append('mediaType', 'video')
      } else {
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
          author: localStorage.getItem('username') || 'You',
          createdAt: created.createdAt || new Date().toISOString(),
          text: created.content || '',
          mediaType: created.mediaType || '',
          mediaName: '',
          mediaPreview: created.media || '',
          likes: created.likes || 0,
          isLiked: false,
        }
        setPosts((prev) => [nextPost, ...prev])
      }

      setContent('')
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
    setContent('')
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

  const toggleLike = (postId) => {
    setPosts((prev) =>
      prev.map((post) => {
        if (post.id !== postId) return post
        const nextLiked = !post.isLiked
        return {
          ...post,
          isLiked: nextLiked,
          likes: nextLiked ? post.likes + 1 : Math.max(0, post.likes - 1),
        }
      })
    )
  }

  const deletePost = (postId) => {
    setPosts((prev) => prev.filter((post) => post.id !== postId))
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
            <h2 className={styles.sectionTitle}>Create Post</h2>
            <form className={styles.postForm} onSubmit={handleCreatePost}>
              <div className={styles.formatBar}>
                <button type="button" className={styles.formatBtn} onClick={() => applyFormat('bold')}>B</button>
                <button type="button" className={styles.formatBtn} onClick={() => applyFormat('italic')}>I</button>
                <button type="button" className={styles.formatBtn} onClick={() => applyFormat('heading')}>H</button>
                <button type="button" className={styles.formatBtn} onClick={() => applyFormat('quote')}>"</button>
                <button type="button" className={styles.formatBtn} onClick={() => applyFormat('bullet')}>•</button>
                <button type="button" className={styles.formatBtn} onClick={() => applyFormat('code')}>{'</>'}</button>
              </div>
              <textarea
                ref={composerRef}
                className={styles.postInput}
                placeholder="Share your thoughts, project updates, or opportunities..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />

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
                      <div>
                        <p className={styles.authorName}>{post.author}</p>
                        <p className={styles.postTime}>{formatDate(post.createdAt)}</p>
                      </div>
                    </div>

                    {post.text && <div className={styles.postText}>{renderFormattedText(post.text)}</div>}

                    {post.mediaPreview && (
                      <div className={styles.postMediaWrap}>
                        {String(post.mediaType).includes('video') ? (
                          <video controls src={post.mediaPreview} className={styles.postMedia} />
                        ) : (
                          <img src={post.mediaPreview} alt={post.mediaName || 'Post media'} className={styles.postMedia} />
                        )}
                      </div>
                    )}

                    <div className={styles.postActions}>
                      <button
                        type="button"
                        className={`${styles.actionBtn} ${post.isLiked ? styles.liked : ''}`}
                        onClick={() => toggleLike(post.id)}
                      >
                        {post.isLiked ? 'Liked' : 'Like'} ({post.likes})
                      </button>
                      <button type="button" className={styles.deleteBtn} onClick={() => deletePost(post.id)}>
                        Delete
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

