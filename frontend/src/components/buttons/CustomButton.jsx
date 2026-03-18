import React from 'react'
import styles from './CustomButton.module.css'
export default function CustomButton({text,style,handler=()=>{}}) {
  return (
    <button className={`${styles.customButton} ${style}`} onClick={handler}>{text||'Button'}</button>
  )
}
