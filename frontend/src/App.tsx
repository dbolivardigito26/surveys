import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import SurveyBuilder from './pages/SurveyBuilder'
import SurveyDetail from './pages/SurveyDetail'
import WaveAnalytics from './pages/WaveAnalytics'
import CompareWaves from './pages/CompareWaves'
import PublicSurvey from './pages/PublicSurvey'
import AdminUsers from './pages/AdminUsers'
import ContinuousAnalytics from './pages/ContinuousAnalytics'
import Layout from './components/Layout'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('token')
  return token ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/s/:slug" element={<PublicSurvey />} />
        <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
          <Route index element={<Dashboard />} />
          <Route path="surveys/new" element={<SurveyBuilder />} />
          <Route path="surveys/:id/edit" element={<SurveyBuilder />} />
          <Route path="surveys/:id" element={<SurveyDetail />} />
          <Route path="surveys/:surveyId/analytics" element={<WaveAnalytics />} />
          <Route path="surveys/:surveyId/compare" element={<CompareWaves />} />
          <Route path="admin/users" element={<AdminUsers />} />
          <Route path="surveys/:surveyId/continuous" element={<ContinuousAnalytics />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
