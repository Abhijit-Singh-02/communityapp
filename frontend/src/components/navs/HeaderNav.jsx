import React, { useMemo } from 'react'
import styles from './HeaderNav.module.css'
import logo from '../../assets/logo.png'
import CustomButton from '../buttons/CustomButton'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined'
import HomeIcon from '@mui/icons-material/Home'
import SmartDisplayOutlinedIcon from '@mui/icons-material/SmartDisplayOutlined'
import SmartDisplayIcon from '@mui/icons-material/SmartDisplay'
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined'
import PeopleAltIcon from '@mui/icons-material/PeopleAlt'
import WorkOutlineOutlinedIcon from '@mui/icons-material/WorkOutlineOutlined'
import WorkIcon from '@mui/icons-material/Work'
import NotificationsNoneOutlinedIcon from '@mui/icons-material/NotificationsNoneOutlined'
import NotificationsIcon from '@mui/icons-material/Notifications'
import ChatBubbleOutlineOutlinedIcon from '@mui/icons-material/ChatBubbleOutlineOutlined'
import ChatBubbleIcon from '@mui/icons-material/ChatBubble'
export default function HeaderNav() {
    const navigate = useNavigate()
    const location = useLocation()
    const userId = localStorage.getItem('userId')

    const navItems = useMemo(() => {
        const uid = userId || ''
        return [
            { key: 'home', label: 'Home', to: '/', icon: (active) => (active ? <HomeIcon /> : <HomeOutlinedIcon />) },
            { key: 'posts', label: 'Posts', to: `/${uid}/posts`, icon: (active) => (active ? <HomeIcon /> : <HomeOutlinedIcon />) },
            { key: 'reels', label: 'Reels', to: `/${uid}/reels`, icon: (active) => (active ? <SmartDisplayIcon /> : <SmartDisplayOutlinedIcon />) },
            { key: 'connect', label: 'Connect', to: `/${uid}/connect`, icon: (active) => (active ? <PeopleAltIcon /> : <PeopleAltOutlinedIcon />) },
            { key: 'jobs', label: 'Jobs', to: `/${uid}/jobs`, icon: (active) => (active ? <WorkIcon /> : <WorkOutlineOutlinedIcon />) },
            { key: 'notifications', label: 'Notifications', to: `/${uid}/notifications`, icon: (active) => (active ? <NotificationsIcon /> : <NotificationsNoneOutlinedIcon />) },
            { key: 'messages', label: 'Messages', to: `/${uid}/messages`, icon: (active) => (active ? <ChatBubbleIcon /> : <ChatBubbleOutlineOutlinedIcon />) },
        ]
    }, [userId])

    const isActive = (to) => {
        const path = location.pathname || ''
        if (to === '/') return path === '/'
        return path.startsWith(to)
    }

    const username = localStorage.getItem('username') || ''
    const firstLetter = username ? username.charAt(0).toUpperCase() : 'U'

    return (
        <header className={styles.headerContainer}>
            {/* Desktop Navigation */}
            <div className={styles.desktopNav}>
                <div className={styles.branding}>
                    <img src={logo} alt="logo" className={styles.logo} />
                    <h1 className={styles.brandingTitle}>Tech Community</h1>
                </div>
                <ul className={styles.menu} aria-label="Primary navigation">
                    {navItems.map((item) => {
                        const active = isActive(item.to)
                        return (
                            <li key={item.key} className={styles.menuItem}>
                                <Link className={`${styles.navLink} ${active ? styles.navLinkActive : ''}`} to={item.to}>
                                    {item.label}
                                </Link>
                            </li>
                        )
                    })}
                </ul>
                <div className={styles.userActions}>
                    <div 
                        className={styles.profileIcon} 
                        title="Profile"
                        onClick={() => navigate(`/${userId}/${username}/profile`)}
                        role="button"
                        tabIndex={0}
                    >
                        {firstLetter}
                    </div>
                </div>
            </div>

            {/* Mobile Top Navigation */}
            <div className={styles.mobileTopNav}>
                <div 
                    className={styles.profileIconSmall} 
                    onClick={() => navigate(`/${userId}/${username}/profile`)}
                    role="button"
                    tabIndex={0}
                >
                    {firstLetter}
                </div>
                <div className={styles.mobileSearchWrapper}>
                    <div className={styles.searchIcon}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    </div>
                    <input 
                        type="text" 
                        placeholder="Search..." 
                        className={styles.mobileSearchInput} 
                        onFocus={() => {
                            // Simple alert for now as per instructions "I'll just wire it up to an alert or make UI"
                            // or leave functional placeholder
                        }}
                    />
                </div>
            </div>

            {/* Bottom Navigation */}
            <nav className={styles.bottomNav} aria-label="Bottom navigation">
                {navItems
                    .filter((i) => i.key !== 'posts') /* keep bottom nav minimal like Instagram */
                    .map((item) => {
                        const active = isActive(item.to)
                        return (
                            <Link
                                key={item.key}
                                to={item.to}
                                className={`${styles.bottomLink} ${active ? styles.bottomLinkActive : ''}`}
                                aria-current={active ? 'page' : undefined}
                                title={item.label}
                            >
                                <span className={styles.bottomIcon} aria-hidden>
                                    {item.icon(active)}
                                </span>
                                <span className={styles.bottomLabel}>{item.label}</span>
                            </Link>
                        )
                    })}
            </nav>
        </header>
    )
}
