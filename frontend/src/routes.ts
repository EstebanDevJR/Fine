import { createRouter, createRoute, createRootRoute } from '@tanstack/react-router'
import { QueryClient } from '@tanstack/react-query'
import { AppShell } from './components/AppShell'
import { UploadPage } from './routes/upload'
import { AuditPage } from './routes/audit'
import { StatusPage } from './routes/status'
import { LandingPage } from './routes/landing'
import { AuthPage } from './routes/auth'
import { ProfilePage } from './routes/profile'
import { AnalysesPage } from './routes/analyses'
import { DashboardPage } from './routes/dashboard'
import { ResetPasswordPage } from './routes/reset'

export const queryClient = new QueryClient()

const rootRoute = createRootRoute({
  component: AppShell,
})

const landingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: LandingPage,
})

const authRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/auth',
  component: AuthPage,
})

const resetRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/auth/reset',
  component: ResetPasswordPage,
})

const uploadRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/upload',
  component: UploadPage,
})

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dashboard',
  component: DashboardPage,
})

const auditRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/audit',
  component: AuditPage,
})

const statusRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/status',
  component: StatusPage,
})

const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/profile',
  component: ProfilePage,
})

const analysesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/analyses',
  component: AnalysesPage,
})

const routeTree = rootRoute.addChildren([
  landingRoute,
  authRoute,
  resetRoute,
  dashboardRoute,
  uploadRoute,
  auditRoute,
  statusRoute,
  profileRoute,
  analysesRoute,
])

export const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

