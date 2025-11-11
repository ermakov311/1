'use client'

import { useLayoutEffect } from 'react'

export default function ThemeInitializer() {
  useLayoutEffect(() => {
    try {
      const saved = localStorage.getItem('app-theme') || 'light'
      document.documentElement.setAttribute('data-theme', saved)
      // ensure listeners get initial value in client transitions
      window.dispatchEvent(new CustomEvent('themechange', { detail: saved }))
    } catch {}
  }, [])
  return null
}


