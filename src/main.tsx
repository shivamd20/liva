import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import { Toaster } from 'sonner'
import './main.css'
import { App } from './App'
import '../app/globals.css'

const PERSIST_MAX_AGE = 1000 * 60 * 60 * 24 // 24 hours

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
      gcTime: PERSIST_MAX_AGE, // >= persist maxAge so cache is not GC'd before restore
    },
  },
})

const persister = createSyncStoragePersister({
  storage: typeof window === 'undefined' ? undefined : window.localStorage,
  key: 'liva-query-cache',
})

import { ThemeProvider } from "./components/theme-provider"
import { initClarity } from './lib/clarity'

initClarity()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister, maxAge: PERSIST_MAX_AGE }}
      >
        <BrowserRouter>
          <App />
          <Toaster />
        </BrowserRouter>
      </PersistQueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
)
