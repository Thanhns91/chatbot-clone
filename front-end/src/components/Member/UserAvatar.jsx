import { useState, useRef, useEffect } from 'react'
import Button from 'react-bootstrap/Button'
import './Member.scss'

const UserAvatar = ({ user, onLogout }) => {
    const [open, setOpen] = useState(false)
    const ref = useRef(null)
    const initial = user?.name?.charAt(0).toUpperCase() || 'U'

    // Đóng menu khi click ra ngoài
    useEffect(() => {
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false)
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    return (
        <div className="member-avatar__wrap" ref={ref}>
            <Button
                className="member-avatar__btn"
                onClick={() => setOpen((v) => !v)}
                title={user?.name}
            >
                {initial}
            </Button>

            {open && (
                <div className="member-avatar__menu">
                    <div className="member-avatar__info">
                        <strong>{user?.name}</strong>
                        <span>{user?.email}</span>
                        <span className="member-avatar__role-badge">{user?.role}</span>
                    </div>
                    <hr className="member-avatar__divider" />
                    <Button
                        variant="outline-secondary"
                        className="member-avatar__logout"
                        onClick={() => { setOpen(false); onLogout() }}
                    >
                        <i className="ti ti-logout me-2" />
                        Logout
                    </Button>
                </div>
            )}
        </div>
    )
}

export default UserAvatar