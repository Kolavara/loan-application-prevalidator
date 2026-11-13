import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Submission from './pages/Submission'
import Dashboard from './pages/Dashboard'
import Handler from './pages/Handler'
import Routing from './pages/Routing'
import Analytics from './pages/Analytics'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/submit" replace />} />
          <Route path="submit" element={<Submission />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="handlers" element={<Handler />} />
          <Route path="routing" element={<Routing />} />
          <Route path="analytics" element={<Analytics />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
