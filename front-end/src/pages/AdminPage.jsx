import { useState } from 'react'
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

export default function AdminPage({ onLogout }) {
  const [page, setPage] = useState('home')
  const Page = PAGES[page]

  return (
    <div className="admin-wrapper">
      <Sidebar active={page} onNav={setPage} onLogout={onLogout} />
      <div className="admin-main">
        <Page />
      </div>
    </div>
  )
}