import React, { useEffect, useMemo, useState } from 'react'
import styles from './Jobs.module.css'
import HeaderNav from '../components/navs/HeaderNav'
import axios from 'axios'
import { serverUrl } from '../../config.mjs'
import { useNavigate } from 'react-router-dom'
export default function Jobs() {
  const navigate = useNavigate()
  const token = useMemo(() => localStorage.getItem('token'), [])
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) {
      navigate('/login', { replace: true })
      return
    }
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const res = await axios.get(`${serverUrl}/jobs`, {
          headers: { Authorization: `Bearer ${token}` },
          params: { page: 1, limit: 50 },
        })
        setJobs(res.data?.jobs || [])
      } catch (err) {
        if (err?.response?.status === 401) navigate('/login', { replace: true })
        setError(err?.response?.data?.message || 'Could not load jobs.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [token, navigate])

  const formatDate = (iso) => {
    try {
      return new Date(iso).toLocaleString()
    } catch {
      return ''
    }
  }

  const mailtoForJob = (job) => {
    const email = job?.userId?.email || ''
    const title = job?.job?.title || 'Job'
    const company = job?.job?.company || ''
    const subject = encodeURIComponent(`Application: ${title}${company ? ` @ ${company}` : ''}`)
    const body = encodeURIComponent(
      `Hi ${job?.userId?.username || ''},\n\nI’d like to apply for the ${title} role.\n\nMy details:\n- Name:\n- Phone:\n- LinkedIn/GitHub:\n\nResume: (attach)\n\nThanks,`
    )
    return `mailto:${email}?subject=${subject}&body=${body}`
  }

  return (
    <div className={styles.page}>
      <HeaderNav />
      <div className={styles.jobsContainer}>
        <div className={styles.jobsHeader}>
          <h1 className={styles.title}>Jobs</h1>
          <p className={styles.subtitle}>Only job posts are shown here.</p>
        </div>
      </div>

      {error && <div className={styles.error}>{error}</div>}
      {loading && <div className={styles.hint}>Loading jobs…</div>}
      {!loading && !error && jobs.length === 0 && <div className={styles.hint}>No jobs yet.</div>}

      <div className={styles.jobsList}>
        {jobs.map((j) => {
          const title = j?.job?.title || 'Job'
          const meta = [j?.job?.company, j?.job?.location, j?.job?.employmentType].filter(Boolean).join(' · ')
          const posterEmail = j?.userId?.email
          return (
            <article key={j._id} className={styles.jobItem}>
              <div className={styles.jobTop}>
                <div>
                  <h2 className={styles.jobTitle}>{title}</h2>
                  {meta && <p className={styles.jobMeta}>{meta}</p>}
                  <p className={styles.jobPoster}>
                    Posted by <strong>@{j?.userId?.username || 'member'}</strong> · {formatDate(j.createdAt)}
                  </p>
                </div>
                <div className={styles.jobActions}>
                  <a
                    className={`${styles.applyBtn} ${!posterEmail ? styles.applyDisabled : ''}`}
                    href={posterEmail ? mailtoForJob(j) : undefined}
                    onClick={(e) => {
                      if (!posterEmail) e.preventDefault()
                    }}
                    aria-disabled={!posterEmail}
                    title={!posterEmail ? 'Poster email not available' : 'Apply via email'}
                  >
                    Apply
                  </a>
                </div>
              </div>

              {j?.content && <div className={styles.jobDescription}>{j.content}</div>}
            </article>
          )
        })}
      </div>
    </div>
  )
}   
