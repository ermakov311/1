'use client'

import SwitchTheme from '@/components/UI/SwitchTheme/SwitchTheme'
import MenuWithRouting from '@/components/elements/Home/MenuWithRouting/MenuWithRouting'
import Main from '@/components/elements/Main/Main'

export default function Home() {
  return (
    <div className="App">
      <SwitchTheme />
      <MenuWithRouting />
      <Main />
    </div>
  )
}
