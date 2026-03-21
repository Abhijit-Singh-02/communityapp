import React from 'react'
import styles from './HeaderNav.module.css'
import logo from '../../assets/logo.png'
import CustomButton from '../buttons/CustomButton'
import { useNavigate,Link } from 'react-router-dom'
export default function HeaderNav() {
    const navigate = useNavigate()
    let menuItems = [
        'Posts',
        'Reels',
        'Connect',
        'Jobs',
        'Notifications',
        'Messages'
    ]
    const userId = localStorage.getItem('userId')
    return (
        <div className={styles.headerNav}>
            <div className={styles.branding}>
                <img src={logo} alt="logo" className={styles.logo} />
                <h1 className={styles.brandingTitle}>Tech Community</h1>
            </div>
            <ul className={styles.menu}>
            <li className={styles.menuItem}><Link to={`/`}>{'Home'}</Link></li>
                {menuItems.map((item, index) => (
                    <li key={index} className={styles.menuItem}><Link to={`/${userId}/${item.toLowerCase()}`}>{item}</Link></li>
                ))}
            </ul>
            <div className={styles.userActions}>
                <CustomButton text="Profile" handler={() => navigate(`/${localStorage.getItem('userId')}/${localStorage.getItem('username')}/profile`)} />
            </div>
        </div>
    )
}
