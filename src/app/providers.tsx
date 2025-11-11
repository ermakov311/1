'use client'

import { Provider } from 'react-redux'
import { store } from '@/store/store'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(() => new QueryClient())
  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
      <DndProvider backend={HTML5Backend}>
        {children}
      </DndProvider>
      </QueryClientProvider>
    </Provider>
  )
}
