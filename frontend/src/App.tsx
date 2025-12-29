import { RouterProvider } from '@tanstack/react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import { router, queryClient } from './routes'
import { AuthProvider } from './api/AuthProvider'
import { ThemeProvider } from './components/ThemeContext'
import { ToastProvider } from './components/ToastProvider'
import { ErrorBoundary } from './components/ErrorBoundary'

export default function App() {
  return (
    <ThemeProvider>
      <ErrorBoundary>
        <ToastProvider>
          <AuthProvider>
            <QueryClientProvider client={queryClient}>
              <RouterProvider router={router} />
            </QueryClientProvider>
          </AuthProvider>
        </ToastProvider>
      </ErrorBoundary>
    </ThemeProvider>
  )
}
