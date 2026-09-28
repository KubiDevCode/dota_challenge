import { ErrorBoundary } from './app/providers/error-boundary'
import { QueryProvider } from './app/providers/query-client'
import { RouterProvider } from './app/providers/router'
import { AppRoutes } from './app/routes'

export default function App() {
  return <ErrorBoundary><QueryProvider><RouterProvider><AppRoutes /></RouterProvider></QueryProvider></ErrorBoundary>
}
