import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import HomePage from './pages/HomePage'
import AdminPage from './pages/AdminPage'
import TeacherPage from './pages/TeacherPage'
import './App.css'

function App() {
  return (
    <BrowserRouter>
   <ToastContainer
  position="top-right"
  autoClose={3000}
  newestOnTop
  closeOnClick
  pauseOnHover
/>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/teacher" element={<TeacherPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App