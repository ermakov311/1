'use client'

import MenuEditor from '@/components/elements/Editor/MenuEditor/MenuEditor'
import { Workarea } from '@/components/elements/Editor/Workarea/Workarea'
import SwitchTheme from '@/components/UI/SwitchTheme/SwitchTheme'
import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useDispatch } from 'react-redux'
import { resetProject } from '@/store/project/projectSlice'

export default function SchemePage() {
  const searchParams = useSearchParams();
  const assignmentId = searchParams?.get('assignmentId');
  const dispatch = useDispatch();
  useEffect(() => {
    // Если открыли чистый редактор (без assignmentId) — очистить проект и локальный черновик
    if (!assignmentId) {
      try { localStorage.removeItem('scheme:global'); } catch {}
      dispatch(resetProject());
    }
  }, [assignmentId, dispatch]);
  return (
    <div className="App" style={{ minHeight: '100vh', position: 'relative' }}>
      <SwitchTheme />
      <MenuEditor />
      <div style={{ paddingLeft: '470px', width: '100%', height: '100vh' }}>
        <Workarea />
      </div>
    </div>
  )
}
