import { useState } from 'react'
import { useNavigate } from 'react-router-dom'  // thêm
import { logout } from '../services/authService'  // thêm
import '../components/Admin/Admin.css'

import Sidebar from '../components/Admin/Sidebar'
import HomePage from '../components/Admin/HomePage'
import UsersPage from '../components/Admin/UsersPage'
import DocumentsPage from '../components/Admin/DocumentsPage'
import AISettingsPage from '../components/Admin/AISettingsPage'

const PAGES = {
  home: HomePage,
  users: UsersPage,
  documents: DocumentsPage,
  ai: AISettingsPage,
}

export default function AdminPage() {
  const [page, setPage] = useState('home')
  const navigate = useNavigate()
  const Page = PAGES[page]

  const handleLogout = () => {
    logout()
    localStorage.removeItem('currentUser')
    sessionStorage.clear()
    navigate('/')
  }

  return (
    <div className="admin-wrapper">
      <Sidebar active={page} onNav={setPage} onLogout={handleLogout} />
      <div className="admin-main">
        <Page />
      </div>
    </div>
  )
}