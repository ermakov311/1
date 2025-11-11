'use client'

import MenuEditor from '@/components/elements/Editor/MenuEditor/MenuEditor'
import SwitchTheme from '@/components/UI/SwitchTheme/SwitchTheme'

export default function CodeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="App" style={{ minHeight: '100vh', position: 'relative' }}>
      <SwitchTheme />
      <MenuEditor />
      <main style={{ paddingLeft: '470px', width: '100%', height: '100vh', display: 'flex', justifyContent: 'center' }}>
        {children}
      </main>
    </div>
  )
}

