import { Navigate, createBrowserRouter } from 'react-router'

import { RootLayout } from '@/routes/root-layout'
import { HomePage } from '@/routes/home'
import { AboutPage } from '@/routes/about'
import { IdeasPage } from '@/routes/ideas'
import { StudiesPage } from '@/routes/studies'
import { SurveyDetailPage } from '@/routes/survey-detail'
import { ExperimentDetailPage } from '@/routes/experiment-detail'
import { NotFoundPage } from '@/routes/not-found'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'about', element: <AboutPage /> },
      { path: 'ideas', element: <IdeasPage /> },
      { path: 'studies', element: <StudiesPage /> },

      // The old listing paths, kept as redirects rather than deleted: video
      // descriptions and existing links point at them, and they should not
      // start 404ing. `replace` keeps them out of the back-button history, so
      // Back from /studies goes where the visitor actually came from.
      //
      // The `:slug` routes below are separate entries and are unaffected —
      // deep links to an individual survey or experiment still resolve.
      { path: 'surveys', element: <Navigate to="/studies" replace /> },
      { path: 'surveys/:slug', element: <SurveyDetailPage /> },
      { path: 'experiments', element: <Navigate to="/studies" replace /> },
      { path: 'experiments/:slug', element: <ExperimentDetailPage /> },

      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
