'use client'

import SwitchTheme from '@/components/UI/SwitchTheme/SwitchTheme'
import Menu from '@/components/elements/Home/Menu/Menu'

export default function GroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="App" style={{ minHeight: '100vh', position: 'relative' }}>
      <SwitchTheme />
      <Menu />
      <main style={{ paddingLeft: '470px', width: '100%' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          {children}
        </div>
      </main>
    </div>
  )
}



