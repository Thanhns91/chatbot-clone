import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { logout } from '../../services/authService'
import ChatLayout from '../Layout/ChatLayout'
import UserAvatar from './UserAvatar'
import ChatArea from './ChatArea'
import './Member.scss'

const MemberPage = () => {
    const navigate = useNavigate()
    const { username, conversationId } = useParams()

    const user = JSON.parse(
        localStorage.getItem('currentUser') ||
        sessionStorage.getItem('currentUser') ||
        'null'
    )

    const [conversations, setConversations] = useState([
        { id: '1', title: 'hello', preview: 'hello', date: 'Today', messageCount: 2, starred: false },
    ])

    // conversationId từ URL, fallback về cái đầu tiên
    const activeId = conversationId || conversations[0]?.id

    const handleSelect = (id) => {
        navigate(`/u/${username}/chat/${id}`)
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
        navigate(`/u/${username}/chat/${newId}`)
    }

    const handleLogout = () => {
        logout()
        localStorage.removeItem('currentUser')
        sessionStorage.clear()
        navigate('/')
    }

    return (
        <ChatLayout
            conversations={conversations}
            setConversations={setConversations}
            activeId={activeId}
            onSelect={handleSelect}
            onNew={handleNew}
            currentUser={user}
            headerRight={<UserAvatar user={user} onLogout={handleLogout} />}
        >
            <ChatArea conversationId={activeId} />
        </ChatLayout>
    )
}

export default MemberPage