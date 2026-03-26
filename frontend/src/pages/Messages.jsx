import React, { useEffect, useMemo, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import HeaderNav from '../components/navs/HeaderNav'
import { serverUrl } from '../../config.mjs'
import styles from './Messages.module.css'

export default function Messages() {
  const navigate = useNavigate()
  const token = useMemo(() => localStorage.getItem('token'), [])
  const currentUserId = localStorage.getItem('userId') || ''

  const [conversations, setConversations] = useState([])
  const [activeConvId, setActiveConvId] = useState(null)
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [typing, setTyping] = useState(false)
  const [otherTyping, setOtherTyping] = useState(false)
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [selectedMessages, setSelectedMessages] = useState(new Set())
  const [menuOpen, setMenuOpen] = useState(false)
  
  const [selectedFile, setSelectedFile] = useState(null)
  const fileInputRef = useRef(null)
  
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false)
  
  const [newChatOpen, setNewChatOpen] = useState(false)
  const [userQuery, setUserQuery] = useState('')
  const [userResults, setUserResults] = useState([])
  const [userLoading, setUserLoading] = useState(false)
  
  const [followingIds, setFollowingIds] = useState(() => new Set())

  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token])

  const socketRef = useRef(null)
  const bottomRef = useRef(null)
  const typingTimer = useRef(null)

  const activeConversation = useMemo(
    () => conversations.find((c) => String(c._id) === String(activeConvId)) || null,
    [conversations, activeConvId]
  )

  useEffect(() => {
    if (!token) return
    axios.get(`${serverUrl}/profile`, { headers: authHeaders })
      .then(res => setFollowingIds(new Set((res.data?.user?.followingIds || []).map(String))))
      .catch(() => {})
  }, [token, authHeaders])

  const toggleFollow = async (otherUserId) => {
    if (!otherUserId || !token) return
    const idStr = String(otherUserId)
    // Only following allowed in this UI (clean UI)
    try {
        await axios.post(`${serverUrl}/follow`, { followingUserId: idStr }, { headers: authHeaders })
        setFollowingIds(prev => new Set([...prev, idStr]))
    } catch (err) {
        setError(err?.response?.data?.message || 'Could not follow user.')
    }
  }

  const navigateToProfile = (id, username) => {
      if (id && username) {
          navigate(`/${id}/${username}/profile`)
      }
  }

  const loadInbox = async () => {
    if (!token) return
    try {
      const res = await axios.get(`${serverUrl}/conversations`, {
        headers: authHeaders,
        params: { limit: 50 },
      })
      setConversations(res.data?.conversations || [])
      if (!activeConvId && (res.data?.conversations || []).length > 0) {
        setActiveConvId(res.data.conversations[0]._id)
      }
    } catch (err) {
      if (err?.response?.status === 401) navigate('/login', { replace: true })
      setError(err?.response?.data?.message || 'Could not load conversations.')
    }
  }

  const searchUsers = async () => {
    if (!token) return
    setUserLoading(true)
    setError('')
    try {
      const res = await axios.get(`${serverUrl}/users`, {
        headers: authHeaders,
        params: { page: 1, limit: 20, ...(userQuery.trim() ? { q: userQuery.trim() } : {}) },
      })
      setUserResults(res.data?.users || [])
    } catch (err) {
      if (err?.response?.status === 401) navigate('/login', { replace: true })
      setError(err?.response?.data?.message || 'Could not search users.')
    } finally {
      setUserLoading(false)
    }
  }

  const startChat = async (otherUser) => {
    if (!otherUser?._id || !token) return
    setError('')
    try {
      const res = await axios.post(
        `${serverUrl}/conversations`,
        { otherUserId: otherUser._id },
        { headers: { ...authHeaders, 'Content-Type': 'application/json' } }
      )
      const convId = res.data?.conversation?._id
      if (convId) {
        await loadInbox()
        setActiveConvId(convId)
        setIsMobileChatOpen(true)
        setNewChatOpen(false)
        setUserQuery('')
        setUserResults([])
      }
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not start chat.')
    }
  }

  const loadMessages = async (conversationId) => {
    if (!token || !conversationId) return
    setLoading(true)
    setError('')
    try {
      const res = await axios.get(`${serverUrl}/conversations/${conversationId}/messages`, {
        headers: authHeaders,
        params: { page: 1, limit: 100 },
      })
      setMessages(res.data?.messages || [])
      await axios.post(`${serverUrl}/conversations/${conversationId}/read`, {}, { headers: authHeaders })
    } catch (err) {
      if (err?.response?.status === 401) navigate('/login', { replace: true })
      setError(err?.response?.data?.message || 'Could not load messages.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!token) {
      navigate('/login', { replace: true })
      return
    }
    loadInbox()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, navigate])

  useEffect(() => {
    if (!token) return
    const socket = io(serverUrl, { auth: { token } })
    socketRef.current = socket

    socket.on('connect_error', () => {
      setError('Messaging connection failed.')
    })

    socket.on('message_new', (msg) => {
      if (!msg?.conversationId) return
      setMessages((prev) => {
        if (String(msg.conversationId) !== String(activeConvId)) return prev
        if (prev.some((m) => String(m._id) === String(msg._id))) return prev
        return [...prev, msg]
      })
      loadInbox()
      if (String(msg.conversationId) === String(activeConvId)) {
        socket.emit('read', { conversationId: msg.conversationId })
      }
    })

    socket.on('message_edited', (payload) => {
      if (!payload?.messageId) return
      if (String(payload.conversationId) !== String(activeConvId)) return
      setMessages((prev) =>
        prev.map((m) =>
          String(m._id) === String(payload.messageId)
            ? { ...m, text: payload.text, isEdited: true, editedAt: payload.editedAt }
            : m
        )
      )
      loadInbox()
    })

    socket.on('message_deleted', (payload) => {
      if (!payload?.messageId) return
      if (String(payload.conversationId) !== String(activeConvId)) return
      setMessages((prev) =>
        prev.map((m) =>
          String(m._id) === String(payload.messageId)
            ? { ...m, status: 'deleted', text: '[deleted]' }
            : m
        )
      )
      loadInbox()
    })

    socket.on('typing', ({ conversationId, userId, isTyping }) => {
      if (String(conversationId) !== String(activeConvId)) return
      if (String(userId) === String(currentUserId)) return
      setOtherTyping(!!isTyping)
    })

    socket.on('inbox_updated', () => {
      loadInbox()
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, activeConvId])

  useEffect(() => {
    if (!activeConvId || !socketRef.current) return
    socketRef.current.emit('join_conversation', { conversationId: activeConvId })
    loadMessages(activeConvId)
    setOtherTyping(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConvId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, otherTyping])

  const send = async () => {
    const trimmed = text.trim()
    if ((!trimmed && !selectedFile) || !socketRef.current || !activeConvId) return

    let mediaUrl = null
    let mediaType = null

    if (selectedFile) {
      setLoading(true)
      try {
        const formData = new FormData()
        formData.append('mediaFile', selectedFile)
        const res = await axios.post(`${serverUrl}/messages/upload`, formData, { headers: authHeaders })
        mediaUrl = res.data.mediaUrl
        mediaType = selectedFile.type.startsWith('video/') ? 'video' : 'image'
      } catch (err) {
        setError('Failed to upload attachment.')
        setLoading(false)
        return
      }
    }

    setText('')
    setSelectedFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    setLoading(false)

    socketRef.current.emit('send_message', { 
        conversationId: activeConvId, 
        text: trimmed,
        mediaUrl,
        mediaType
    })
  }

  const formatTime = (iso) => {
    try {
      return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } catch {
      return ''
    }
  }

  const longPressTimer = useRef(null)

  const handlePointerDown = (m) => {
    if (isSelectionMode) return
    longPressTimer.current = setTimeout(() => {
      setIsSelectionMode(true)
      setSelectedMessages(new Set([m._id]))
    }, 500)
  }

  const handlePointerUp = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current)
  }

  const toggleSelection = (m) => {
    if (!isSelectionMode) return
    setSelectedMessages(prev => {
      const next = new Set(prev)
      if (next.has(m._id)) next.delete(m._id)
      else next.add(m._id)
      if (next.size === 0) setIsSelectionMode(false)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedMessages.size === messages.length && messages.length > 0) {
      setSelectedMessages(new Set())
      setIsSelectionMode(false)
    } else {
      setSelectedMessages(new Set(messages.map(m => m._id)))
      setIsSelectionMode(true)
    }
    setMenuOpen(false)
  }

  const deleteSelected = () => {
    if (!socketRef.current || selectedMessages.size === 0) return
    if (!window.confirm(`Delete ${selectedMessages.size} message(s)?`)) return
    
    selectedMessages.forEach(msgId => {
      const msg = messages.find(m => m._id === msgId)
      if (msg && String(msg.senderId) === String(currentUserId)) {
         socketRef.current.emit('delete_message', { messageId: msgId })
      }
    })
    setIsSelectionMode(false)
    setSelectedMessages(new Set())
    setMenuOpen(false)
  }

  const onTyping = (val) => {
    setText(val)
    if (!socketRef.current || !activeConvId) return

    if (!typing) {
      setTyping(true)
      socketRef.current.emit('typing', { conversationId: activeConvId, isTyping: true })
    }
    if (typingTimer.current) clearTimeout(typingTimer.current)
    typingTimer.current = setTimeout(() => {
      setTyping(false)
      socketRef.current?.emit('typing', { conversationId: activeConvId, isTyping: false })
    }, 900)
  }

  return (
    <div className={styles.page}>
      <HeaderNav />
      <div className={`${styles.wrap} ${isMobileChatOpen ? styles.mobileChatOpen : ''}`}>
        <aside className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <h1 className={styles.title}>Messaging</h1>
            <button type="button" className={styles.newBtn} onClick={() => setNewChatOpen(true)}>
              New
            </button>
          </div>
          {error && <div className={styles.error}>{error}</div>}
          <div className={styles.convList}>
            {conversations.map((c) => {
              const other = c.otherUser
              const active = String(c._id) === String(activeConvId)
              return (
                <button
                  key={c._id}
                  type="button"
                  className={`${styles.convRow} ${active ? styles.convRowActive : ''}`}
                  onClick={() => {
                    setActiveConvId(c._id)
                    setIsMobileChatOpen(true)
                  }}
                >
                  <span 
                    className={`${styles.avatar} ${styles.clickableAvatar}`} 
                    aria-hidden 
                    onClick={(e) => {
                      e.stopPropagation();
                      navigateToProfile(other?._id, other?.username);
                    }}
                    title={`View ${other?.username || 'user'}'s profile`}
                  >
                    {other?.profilePicture ? (
                      <img src={other.profilePicture} alt="" className={styles.avatarImg} draggable="false" />
                    ) : (
                      (other?.username || 'M').slice(0, 1).toUpperCase()
                    )}
                  </span>
                  <span className={styles.convMeta}>
                    <span className={styles.convName}>{other?.username || 'Member'}</span>
                    <span className={styles.convPreview}>{c.lastMessageText || 'Say hi…'}</span>
                  </span>
                  {c.unreadCount > 0 && <span className={styles.unread}>{c.unreadCount}</span>}
                </button>
              )
            })}
          </div>
        </aside>

        <section className={styles.chat}>
          {!activeConversation && <div className={styles.empty}>Select a conversation.</div>}
          {activeConversation && (
            <>
              <div className={`${styles.chatHeader} ${isSelectionMode ? styles.selectionHeaderActive : ''}`}>
                {isSelectionMode ? (
                  <>
                    <div className={styles.chatHeaderLeft}>
                      <button className={styles.iconBtn} onClick={() => { setIsSelectionMode(false); setSelectedMessages(new Set()); }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                      </button>
                      <span className={styles.selectionCount}>{selectedMessages.size} selected</span>
                    </div>
                    <div className={styles.selectionActions}>
                      <button className={styles.iconBtn} onClick={toggleSelectAll} title="Select All">
                        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>
                      </button>
                      <button className={styles.iconBtn} onClick={deleteSelected} title="Delete">
                        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className={styles.chatHeaderLeft}>
                        <button 
                            className={styles.mobileBackBtn} 
                            onClick={() => setIsMobileChatOpen(false)}
                            type="button"
                            title="Back to inbox"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                        </button>
                        <div 
                            className={styles.chatHeaderInfo}
                            onClick={() => navigateToProfile(activeConversation.otherUser._id, activeConversation.otherUser.username)}
                        >
                          <div className={styles.avatar} style={{width: 40, height: 40}}>
                              {activeConversation.otherUser?.profilePicture ? (
                                  <img src={activeConversation.otherUser.profilePicture} alt="" className={styles.avatarImg} draggable="false" />
                              ) : (
                                  (activeConversation.otherUser?.username || 'U').slice(0, 1).toUpperCase()
                              )}
                          </div>
                          <div>
                              <div className={styles.chatTitle}>{activeConversation.otherUser?.username || 'Member'}</div>
                              {otherTyping && <div className={styles.typing}>Typing…</div>}
                          </div>
                        </div>
                    </div>
                    
                    <div className={styles.chatHeaderRight}>
                      {!followingIds.has(String(activeConversation.otherUser._id)) && (
                          <button 
                              type="button" 
                              className={styles.followBtn}
                              onClick={() => toggleFollow(activeConversation.otherUser._id)}
                          >
                              + Follow
                          </button>
                      )}
                      <div className={styles.menuContainer}>
                        <button className={styles.iconBtn} onClick={() => setMenuOpen(!menuOpen)}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>
                        </button>
                        {menuOpen && (
                          <div className={styles.dropdownMenu}>
                            <button className={styles.dropdownItem} onClick={() => { setIsSelectionMode(true); setMenuOpen(false); }}>Select Messages</button>
                            <button className={styles.dropdownItem} onClick={toggleSelectAll}>Select All</button>
                            {selectedMessages.size > 0 && <button className={`${styles.dropdownItem} ${styles.dangerText}`} onClick={deleteSelected}>Delete Selected</button>}
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className={styles.msgList}>
                {loading && <div className={styles.hint}>Loading…</div>}
                {!loading &&
                  messages.map((m) => {
                    const mine = String(m.senderId) === String(currentUserId)
                    const isSelected = selectedMessages.has(m._id)
                    return (
                      <div 
                        key={m._id} 
                        className={`${styles.msgRowWrapper} ${isSelected ? styles.msgSelected : ''}`}
                        onClick={() => toggleSelection(m)}
                        onPointerDown={() => handlePointerDown(m)}
                        onPointerUp={handlePointerUp}
                        onPointerCancel={handlePointerUp}
                        onContextMenu={(e) => {
                           if (!isSelectionMode) {
                              e.preventDefault();
                              setIsSelectionMode(true);
                              setSelectedMessages(new Set([m._id]));
                           }
                        }}
                      >
                        {isSelectionMode && (
                          <div className={styles.checkboxContainer}>
                            <div className={`${styles.checkbox} ${isSelected ? styles.checkboxChecked : ''}`}>
                              {isSelected && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                            </div>
                          </div>
                        )}
                        <div className={`${styles.msgRow} ${mine ? styles.msgRowMine : ''}`}>
                          {!mine && activeConversation.otherUser && !isSelectionMode && (
                            <div 
                                className={`${styles.msgAvatar} ${styles.clickableAvatar}`} 
                                onClick={(e) => { e.stopPropagation(); navigateToProfile(activeConversation.otherUser._id, activeConversation.otherUser.username); }}
                                title={`View ${activeConversation.otherUser.username}'s profile`}
                            >
                               {activeConversation.otherUser.profilePicture ? (
                                 <img src={activeConversation.otherUser.profilePicture} alt="" className={styles.avatarImg} draggable="false" />
                               ) : (
                                 (activeConversation.otherUser.username || 'U').slice(0, 1).toUpperCase()
                               )}
                            </div>
                          )}

                          <div className={`${styles.bubble} ${mine ? styles.bubbleMine : styles.bubbleOther}`}>
                            <>
                              {m.mediaUrl && (
                                <div className={styles.msgMediaWrap}>
                                  {String(m.mediaType).includes('video') ? (
                                    <video src={m.mediaUrl} controls className={styles.msgMedia} />
                                  ) : (
                                    <img src={m.mediaUrl} alt="Attachment" className={styles.msgMedia} />
                                  )}
                                </div>
                              )}
                              {m.text && <div className={styles.msgText}>{m.text}</div>}
                              <div className={styles.msgMeta}>
                                {m.isEdited && m.status !== 'deleted' ? 'edited · ' : ''}
                                {formatTime(m.createdAt)}
                              </div>
                            </>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                <div ref={bottomRef} />
              </div>

              <div className={styles.composerWrapper}>
                {selectedFile && (
                  <div className={styles.composerPreview}>
                    <span className={styles.previewName}>Attachment: {selectedFile.name}</span>
                    <button type="button" onClick={() => setSelectedFile(null)} className={styles.removeFileBtn}>×</button>
                  </div>
                )}
                <div className={styles.composer}>
                  <button 
                    type="button" 
                    className={styles.attachBtn} 
                    onClick={() => fileInputRef.current?.click()}
                    title="Attach Image or Video"
                  >
                    📎
                  </button>
                  <input 
                    type="file" 
                    accept="image/*,video/*" 
                    style={{display: 'none'}} 
                    ref={fileInputRef}
                    onChange={(e) => {
                      if (e.target.files?.[0]) setSelectedFile(e.target.files[0])
                    }}
                  />
                  <input
                    className={styles.input}
                    value={text}
                    onChange={(e) => onTyping(e.target.value)}
                    placeholder="Write a message…"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') send()
                    }}
                  />
                  <button type="button" className={styles.sendBtn} onClick={send} disabled={(!text.trim() && !selectedFile) || loading}>
                    {loading ? '…' : 'Send'}
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      {newChatOpen && (
        <div className={styles.modal} role="dialog" aria-modal="true" aria-label="Start a new chat">
          <button type="button" className={styles.backdrop} aria-label="Close" onClick={() => setNewChatOpen(false)} />
          <div className={styles.modalCard}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Start a chat</h2>
              <button type="button" className={styles.closeBtn} onClick={() => setNewChatOpen(false)}>
                ×
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.searchRow}>
                <input
                  className={styles.searchInput}
                  value={userQuery}
                  onChange={(e) => setUserQuery(e.target.value)}
                  placeholder="Search users…"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') searchUsers()
                  }}
                />
                <button type="button" className={styles.searchBtn} onClick={searchUsers} disabled={userLoading}>
                  {userLoading ? '…' : 'Search'}
                </button>
              </div>

              {userLoading && <div className={styles.hint}>Searching…</div>}
              {!userLoading && userResults.length === 0 && <div className={styles.hint}>No users found.</div>}

              <div className={styles.userList}>
                {userResults.map((u) => (
                  <button key={u._id} type="button" className={styles.userRow} onClick={() => startChat(u)}>
                    <span className={styles.avatar} aria-hidden>
                      {u.profilePicture ? (
                        <img src={u.profilePicture} alt="" className={styles.avatarImg} />
                      ) : (
                        (u.username || 'M').slice(0, 1).toUpperCase()
                      )}
                    </span>
                    <span className={styles.userMeta}>
                      <span className={styles.convName}>{u.username || 'Member'}</span>
                      <span className={styles.convPreview}>{u.occupation || u.bio || 'Tap to message'}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
