import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { logout } from '../services/authService'
import ChatLayout from '../components/Layout/ChatLayout'
import AuthButton from '../components/Auth/AuthButton'
import UserAvatar from '../components/Member/UserAvatar'
import logo7 from '../assets/images/7.png'
import Form from 'react-bootstrap/Form'
import './HomePage.scss'

// Slug hoá tên: "Member User" -> "member-user"
const toSlug = (name = '') =>
  name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

const HomePage = () => {
  const navigate = useNavigate()
  const [message, setMessage] = useState('')
  const [currentUser, setCurrentUser] = useState(null)

  const [conversations, setConversations] = useState([
    { id: '1', title: 'hello', preview: 'hello', date: 'Today', messageCount: 2, starred: false },
  ])
  const [activeId, setActiveId] = useState('1')

  const handleLoginSuccess = (role, user) => {
    setCurrentUser(user)
    localStorage.setItem('currentUser', JSON.stringify(user))

    if (role === 'admin') navigate('/admin/home')
    else if (role === 'teacher') navigate('/teacher/home')
    else {
      const slug = toSlug(user.name) || 'user'
      navigate(`/u/${slug}/chat`)
    }
  }

  const handleLogout = () => {
    logout()
    localStorage.removeItem('currentUser')
    sessionStorage.clear()
    setCurrentUser(null)
  }

  const handleNew = () => {
    const newId = String(Date.now())
    const newConv = {
      id: newId,
      title: 'New reflection',
      preview: '',
      date: 'Today',
      messageCount: 0,
      starred: false,
    }
    setConversations((prev) => [newConv, ...prev])
    setActiveId(newId)
  }

  return (
    <ChatLayout
      conversations={conversations}
      setConversations={setConversations}
      activeId={activeId}
      onSelect={setActiveId}
      onNew={handleNew}
      currentUser={currentUser}
      headerRight={
        currentUser
          ? <UserAvatar user={currentUser} onLogout={handleLogout} />
          : <AuthButton onLoginSuccess={handleLoginSuccess} />
      }
    >
      <div className="homepage__body">
        <div className="homepage__welcome">
          <img src={logo7} alt="logo" className="homepage__logo" />
          <h1 className="homepage__title">Where should we start?</h1>
          <p className="homepage__subtitle">
            Ask me anything — I am here to help you learn and explore ideas.
          </p>
        </div>
      </div>

      <div className="homepage__input-bar">
        <button className="homepage__tool-btn homepage__tool-btn--attach" title="Attach file or image">
          <i className="ti ti-paperclip" />
        </button>
        <button className="homepage__tool-btn homepage__tool-btn--mic" title="Voice input">
          <i className="ti ti-microphone" />
        </button>
        <Form.Control
          className="homepage__input"
          type="text"
          placeholder="Ask anything..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && setMessage('')}
        />
        <button className={`homepage__send-btn ${message.trim() ? 'homepage__send-btn--active' : ''}`}>
          <i className="ti ti-send" />
        </button>
      </div>
    </ChatLayout>
  )
}

export default HomePage
