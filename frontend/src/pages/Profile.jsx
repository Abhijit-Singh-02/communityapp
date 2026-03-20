import React, { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import styles from './Profile.module.css'
import HeaderNav from '../components/navs/HeaderNav'
export default function Profile() {
  const navigate = useNavigate()
  const token = useMemo(() => localStorage.getItem('token'), [])

  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [isEditing, setIsEditing] = useState(false)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [profilePictureFile, setProfilePictureFile] = useState(null)

  const [form, setForm] = useState({
    username: '',
    email: '',
    phoneNumber: '',
    bio: '',
    address: '',
    education: '',
    dob: '',
    gender: '',
    maritalStatus: '',
    occupation: '',
  })

  useEffect(() => {
    if (!token) {
      navigate('/login', { replace: true })
      return
    }

    const fetchProfile = async () => {
      setLoading(true)
      setError('')
      try {
        const res = await axios.get('http://localhost:8080/profile', {
          headers: { Authorization: `Bearer ${token}` }
        })
        setUser(res.data?.user || null)
      } catch (err) {
        const msg = err?.response?.data?.message || 'Failed to load profile.'
        setError(msg)
        if (err?.response?.status === 401) navigate('/login', { replace: true })
      } finally {
        setLoading(false)
      }
    }

    fetchProfile()
  }, [navigate, token])

  useEffect(() => {
    if (!user) return
    const addressString =
      typeof user.address === 'string'
        ? user.address
        : user.address?.street || ''

    const educationString = Array.isArray(user.education)
      ? user.education.join(', ')
      : user.education || ''

    const dobString = user.dob
      ? new Date(user.dob).toISOString().slice(0, 10)
      : ''

    setForm({
      username: user.username || '',
      email: user.email || '',
      phoneNumber: user.phoneNumber || '',
      bio: user.bio || '',
      address: addressString,
      education: educationString,
      dob: dobString,
      gender: user.gender || '',
      maritalStatus: user.maritalStatus || '',
      occupation: user.occupation || '',
    })
  }, [user])

  const refreshProfile = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await axios.get('http://localhost:8080/profile', {
        headers: { Authorization: `Bearer ${token}` },
      })
      setUser(res.data?.user || null)
    } catch (err) {
      const msg = err?.response?.data?.message || 'Failed to load profile.'
      setError(msg)
      if (err?.response?.status === 401) navigate('/login', { replace: true })
    } finally {
      setLoading(false)
    }
  }

  const avatarText = useMemo(() => {
    const name = user?.username || ''
    return name ? name.trim().slice(0, 1).toUpperCase() : 'U'
  }, [user])

  const formatAddress = (addressValue) => {
    if (!addressValue) return '—'
    if (typeof addressValue === 'string') return addressValue
    const parts = []
    if (addressValue.street) parts.push(addressValue.street)
    if (addressValue.city) parts.push(addressValue.city)
    if (addressValue.state) parts.push(addressValue.state)
    if (addressValue.zip) parts.push(addressValue.zip)
    if (addressValue.country) parts.push(addressValue.country)
    return parts.length ? parts.join(', ') : '—'
  }

  return (
    <>
    <HeaderNav />
    <div className={styles.profilePage}>
      <div className={styles.profileCard}>
        <div className={styles.profileTop}>
          {user?.profilePicture ? (
            <img
              src={user.profilePicture}
              alt="Profile"
              className={styles.profileAvatarImg}
            />
          ) : (
            <div className={styles.profileAvatar} aria-hidden="true">
              {avatarText}
            </div>
          )}
          <div className={styles.profileHeading}>
            <h1 className={styles.profileName}>{user?.username || 'Loading...'}</h1>
            <p className={styles.profileEmail}>{user?.email || ''}</p>
          </div>
        </div>

        {loading && <div className={styles.loading}>Loading your profile...</div>}
        {!loading && error && <div className={styles.error}>{error}</div>}

        {!loading && !error && user && (
          <>
            <div className={styles.profileActions}>
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
            </div>

            {!isEditing ? (
              <div className={styles.profileGrid}>
                <div className={styles.profileItem}>
                  <div className={styles.profileLabel}>Username</div>
                  <div className={styles.profileValue}>{user.username}</div>
                </div>
                <div className={styles.profileItem}>
                  <div className={styles.profileLabel}>Phone Number</div>
                  <div className={styles.profileValue}>{user.phoneNumber}</div>
                </div>
                <div className={styles.profileItem}>
                  <div className={styles.profileLabel}>Email</div>
                  <div className={styles.profileValue}>{user.email}</div>
                </div>
                <div className={styles.profileItem}>
                  <div className={styles.profileLabel}>Bio</div>
                  <div className={styles.profileValue}>{user.bio || '—'}</div>
                </div>
                <div className={styles.profileItem}>
                  <div className={styles.profileLabel}>Address</div>
                  <div className={styles.profileValue}>{formatAddress(user.address)}</div>
                </div>
                <div className={styles.profileItem}>
                  <div className={styles.profileLabel}>Occupation</div>
                  <div className={styles.profileValue}>{user.occupation || '—'}</div>
                </div>
              </div>
            ) : (
              <form
                className={styles.editForm}
                onSubmit={async (e) => {
                  e.preventDefault()
                  setSubmitLoading(true)
                  setSubmitError('')
                  try {
                    const formData = new FormData()
                    formData.append('username', form.username)
                    formData.append('email', form.email)
                    formData.append('phoneNumber', form.phoneNumber)
                    formData.append('bio', form.bio)
                    formData.append('address', form.address)
                    formData.append('education', form.education)
                    formData.append('dob', form.dob)
                    formData.append('gender', form.gender)
                    formData.append('maritalStatus', form.maritalStatus)
                    formData.append('occupation', form.occupation)
                    if (profilePictureFile) {
                      formData.append('profilePicture', profilePictureFile)
                    }

                    await axios.put('http://localhost:8080/profile', formData, {
                      headers: { Authorization: `Bearer ${token}` },
                    })

                    setIsEditing(false)
                    setProfilePictureFile(null)
                    await refreshProfile()
                  } catch (err) {
                    setSubmitError(err?.response?.data?.message || 'Profile update failed.')
                    if (err?.response?.status === 401) navigate('/login', { replace: true })
                  } finally {
                    setSubmitLoading(false)
                  }
                }}
              >
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
                    <span className={styles.fieldLabel}>Email</span>
                    <input
                      className={styles.fieldInput}
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      required
                    />
                  </label>

                  <label className={styles.field}>
                    <span className={styles.fieldLabel}>Phone Number</span>
                    <input
                      className={styles.fieldInput}
                      value={form.phoneNumber}
                      onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
                      required
                    />
                  </label>

                  <label className={styles.field}>
                    <span className={styles.fieldLabel}>Profile Picture</span>
                    <input
                      className={styles.fieldInput}
                      type="file"
                      accept="image/*"
                      onChange={(e) => setProfilePictureFile(e.target.files?.[0] || null)}
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
                    <span className={styles.fieldLabel}>Address</span>
                    <input
                      className={styles.fieldInput}
                      value={form.address}
                      onChange={(e) => setForm({ ...form, address: e.target.value })}
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

                  <label className={styles.field}>
                    <span className={styles.fieldLabel}>DOB</span>
                    <input
                      className={styles.fieldInput}
                      value={form.dob}
                      onChange={(e) => setForm({ ...form, dob: e.target.value })}
                      placeholder="YYYY-MM-DD"
                    />
                  </label>

                  <label className={styles.field}>
                    <span className={styles.fieldLabel}>Gender</span>
                    <input
                      className={styles.fieldInput}
                      value={form.gender}
                      onChange={(e) => setForm({ ...form, gender: e.target.value })}
                    />
                  </label>

                  <label className={styles.field}>
                    <span className={styles.fieldLabel}>Marital Status</span>
                    <input
                      className={styles.fieldInput}
                      value={form.maritalStatus}
                      onChange={(e) => setForm({ ...form, maritalStatus: e.target.value })}
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
                </div>

                {submitError && <div className={styles.submitError}>{submitError}</div>}

                <div className={styles.editActions}>
                  <button
                    type="button"
                    className={styles.cancelButton}
                    onClick={() => {
                      setSubmitError('')
                      setIsEditing(false)
                      setProfilePictureFile(null)
                    }}
                    disabled={submitLoading}
                  >
                    Cancel
                  </button>
                  <button type="submit" className={styles.saveButton} disabled={submitLoading}>
                    {submitLoading ? 'Saving...' : 'Save changes'}
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </div>
    </div>
    </>
  )
}
