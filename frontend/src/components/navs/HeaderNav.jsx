import React from 'react'
import styles from './HeaderNav.module.css'
import logo from '../../assets/logo.png'
import CustomButton from '../buttons/CustomButton'
export default function HeaderNav() {
    let menuItems = [
        'Posts',
        'Reels',
        'Connect',
        'Jobs',
        'Notifications',
        'Messages'
    ]
    return (
        <div className={styles.headerNav}>
            <div className={styles.branding}>
                <img src={logo} alt="logo" className={styles.logo} />
                <h1 className={styles.brandingTitle}>Tech Community</h1>
            </div>
            <ul className={styles.menu}>
                {menuItems.map((item, index) => (
                    <li key={index} className={styles.menuItem}>{item}</li>
                ))}
            </ul>
            <div className={styles.userActions}>
                <CustomButton text="Profile" />
            </div>
        </div>
    )
}
