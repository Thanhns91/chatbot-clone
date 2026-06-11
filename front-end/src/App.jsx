import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import HomePage from './pages/HomePage'
import AdminPage from './pages/AdminPage'
import TeacherPage from './pages/TeacherPage'
import MemberPage from './components/Member/MemberPage'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />

        {/* Admin */}
        <Route path="/admin" element={<Navigate to="/admin/home" replace />} />
        <Route path="/admin/:page" element={<AdminPage />} />

        {/* Teacher */}
        <Route path="/teacher" element={<Navigate to="/teacher/home" replace />} />
        <Route path="/teacher/:page" element={<TeacherPage />} />

        {/* Member — /u/:username/chat và /u/:username/chat/:conversationId */}
        <Route path="/u/:username/chat" element={<MemberPage />} />
        <Route path="/u/:username/chat/:conversationId" element={<MemberPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App