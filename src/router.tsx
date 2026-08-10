import { createBrowserRouter } from 'react-router'

import { RootLayout } from '@/routes/root-layout'
import { HomePage } from '@/routes/home'
import { AboutPage } from '@/routes/about'
import { SurveysIndexPage } from '@/routes/surveys-index'
import { SurveyDetailPage } from '@/routes/survey-detail'
import { ExperimentsIndexPage } from '@/routes/experiments-index'
import { ExperimentDetailPage } from '@/routes/experiment-detail'
import { NotFoundPage } from '@/routes/not-found'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'about', element: <AboutPage /> },
      { path: 'surveys', element: <SurveysIndexPage /> },
      { path: 'surveys/:slug', element: <SurveyDetailPage /> },
      { path: 'experiments', element: <ExperimentsIndexPage /> },
      { path: 'experiments/:slug', element: <ExperimentDetailPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
