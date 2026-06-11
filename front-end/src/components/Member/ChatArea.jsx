import { useState } from 'react'
import Form from 'react-bootstrap/Form'
import logo7 from '../../assets/images/7.png'
import './Member.scss'

const ChatArea = ({ conversationId }) => {
    const [message, setMessage] = useState('')

    const handleSend = () => {
        if (!message.trim()) return
        // TODO: gửi message tới AI
        setMessage('')
    }

    return (
        <>
            <div className="member-chat__body">
                <div className="member-chat__welcome">
                    <img src={logo7} alt="logo" className="member-chat__logo" />
                    <h1 className="member-chat__title">Where should we start?</h1>
                    <p className="member-chat__subtitle">
                        Ask me anything — I am here to help you learn and explore ideas.
                    </p>
                </div>
            </div>

            <div className="member-chat__input-bar">
                <button
                    className="member-chat__tool-btn member-chat__tool-btn--attach"
                    title="Attach file or image"
                >
                    <i className="ti ti-paperclip" />
                </button>
                <button
                    className="member-chat__tool-btn member-chat__tool-btn--mic"
                    title="Voice input"
                >
                    <i className="ti ti-microphone" />
                </button>
                <Form.Control
                    className="member-chat__input"
                    type="text"
                    placeholder="Ask anything..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                />
                <button
                    className={`member-chat__send-btn ${message.trim() ? 'member-chat__send-btn--active' : ''}`}
                    onClick={handleSend}
                >
                    <i className="ti ti-send" />
                </button>
            </div>
        </>
    )
}

export default ChatArea