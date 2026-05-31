import React, { useEffect, useRef, useState } from "react";
import ChatLayout from "../components/Layout/ChatLayout";
import AuthButton from "../components/Auth/AuthButton";
import TeacherPage from "./TeacherPage";
import AdminPage from "./AdminPage";
import "./HomePage.css";

import {
  uploadFile,
  sendMessage,
  getTeacherDocuments,
  getChatSessions,
  createChatSession,
  getChatMessages,
  saveChatMessage,
} from "../services/api";

const SparkleIcon = () => (
  <svg width="72" height="72" viewBox="0 0 72 72" fill="none">
    <path
      d="M36 8C36 8 40 28 56 36C40 44 36 64 36 64C36 64 32 44 16 36C32 28 36 8 36 8Z"
      fill="none"
      stroke="#4f3ef5"
      strokeWidth="2.8"
      strokeLinejoin="round"
    />
    <path
      d="M56 10C56 10 58 18 64 21C58 24 56 32 56 32C56 32 54 24 48 21C54 18 56 10 56 10Z"
      fill="#4f3ef5"
      opacity="0.85"
    />
    <circle cx="22" cy="16" r="2.5" fill="#4f3ef5" opacity="0.6" />
  </svg>
);

const UserAvatar = ({ user, onLogout }) => {
  const [open, setOpen] = useState(false);
  const initial = user?.name?.charAt(0).toUpperCase() || "U";

  return (
    <div className="homepage__avatar-wrap">
      <button
        className="homepage__avatar"
        onClick={() => setOpen((v) => !v)}
        title={user?.name}
      >
        {initial}
      </button>

      {open && (
        <div className="homepage__avatar-menu">
          <div className="homepage__avatar-info">
            <strong>{user?.name}</strong>
            <span>{user?.email}</span>
            <span className="homepage__avatar-role">{user?.role}</span>
          </div>

          <hr className="homepage__avatar-divider" />

          <button className="homepage__avatar-logout" onClick={onLogout}>
            → Logout
          </button>
        </div>
      )}
    </div>
  );
};

const HomePage = () => {
  const fileInputRef = useRef(null);

  const [conversations, setConversations] = useState([]);
  const [message, setMessage] = useState("");
  const [currentUser, setCurrentUser] = useState(null);

  const [documentId, setDocumentId] = useState("");
  const [selectedDocumentName, setSelectedDocumentName] = useState("");
  const [teacherDocuments, setTeacherDocuments] = useState([]);

  const [chat, setChat] = useState([]);
  const [loading, setLoading] = useState(false);

  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [searchHistory, setSearchHistory] = useState("");

  useEffect(() => {
    async function loadTeacherDocs() {
      try {
        const docs = await getTeacherDocuments();
        setTeacherDocuments(docs);
      } catch (err) {
        console.log("Load teacher documents failed:", err);
      }
    }

    loadTeacherDocs();
  }, []);

  useEffect(() => {
    async function loadHistory() {
      if (!currentUser?.userId) return;

      try {
        const sessions = await getChatSessions(currentUser.userId);
        setConversations(sessions);
      } catch (error) {
        console.error("Load chat history failed:", error);
      }
    }

    loadHistory();
  }, [currentUser]);

  const handleLoginSuccess = (role, user) => {
    setCurrentUser(user);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setDocumentId("");
    setSelectedDocumentName("");
    setChat([]);
    setMessage("");
    setCurrentSessionId(null);
    setConversations([]);
    setSearchHistory("");
  };

  const handleNewChat = async () => {
    setChat([]);
    setMessage("");
    setCurrentSessionId(null);

    if (!currentUser?.userId) return;

    try {
      const data = await createChatSession(
        currentUser.userId,
        documentId || null,
        "New Chat"
      );

      setCurrentSessionId(data.sessionId);

      const sessions = await getChatSessions(currentUser.userId);
      setConversations(sessions);
    } catch (error) {
      console.error("Create new chat failed:", error);
    }
  };

  const handleOpenConversation = async (session) => {
    try {
      setCurrentSessionId(session.sessionId);
      setDocumentId(session.documentId || "");

      const messages = await getChatMessages(session.sessionId);

      setChat(
        messages.map((msg) => ({
          role: msg.sender === "ai" ? "bot" : "user",
          content: msg.message,
        }))
      );
    } catch (error) {
      console.error("Open conversation failed:", error);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current.click();
  };

  const handleUploadPDF = async (e) => {
    const file = e.target.files[0];

    if (!file) return;

    try {
      setLoading(true);

      const data = await uploadFile(file);

      setDocumentId(data.documentId);
      setSelectedDocumentName(data.fileName || file.name);
      setChat([]);
      setCurrentSessionId(null);

      alert(`Upload success: ${data.totalChunks} chunks`);
    } catch (error) {
      console.error(error);
      alert("Upload failed. Please check backend.");
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  };

  const handleSelectTeacherDocument = (e) => {
    const selectedId = e.target.value;

    const selectedDoc = teacherDocuments.find(
      (doc) => doc.documentId === selectedId
    );

    setDocumentId(selectedId);
    setSelectedDocumentName(selectedDoc?.fileName || "");
    setChat([]);
    setCurrentSessionId(null);
  };

  const handleSendMessage = async () => {
    if (!message.trim()) return;

    if (!documentId) {
      alert("Please upload a file or choose a teacher document first.");
      return;
    }

    const userMessage = message.trim();
    setMessage("");

    let sessionId = currentSessionId;

    try {
      if (!sessionId && currentUser?.userId) {
        const newSession = await createChatSession(
          currentUser.userId,
          documentId,
          userMessage.substring(0, 40)
        );

        sessionId = newSession.sessionId;
        setCurrentSessionId(sessionId);

        const sessions = await getChatSessions(currentUser.userId);
        setConversations(sessions);
      }

      setChat((prev) => [
        ...prev,
        {
          role: "user",
          content: userMessage,
        },
      ]);

      if (sessionId) {
        await saveChatMessage(sessionId, "user", userMessage);
      }

      setLoading(true);

      const data = await sendMessage(documentId, userMessage);

      setChat((prev) => [
        ...prev,
        {
          role: "bot",
          content: data.answer,
        },
      ]);

      if (sessionId) {
        await saveChatMessage(sessionId, "ai", data.answer);
      }
    } catch (error) {
      console.error(error);

      setChat((prev) => [
        ...prev,
        {
          role: "bot",
          content: "Error: cannot connect to backend.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const filteredConversations = conversations.filter((item) =>
    item.title?.toLowerCase().includes(searchHistory.toLowerCase())
  );

  if (currentUser?.role === "admin") {
    return <AdminPage user={currentUser} onLogout={handleLogout} />;
  }

  if (currentUser?.role === "teacher") {
    return <TeacherPage user={currentUser} onLogout={handleLogout} />;
  }

  return (
    <ChatLayout
      conversations={filteredConversations}
      searchHistory={searchHistory}
      onSearchHistory={setSearchHistory}
      onNew={handleNewChat}
      onOpenConversation={handleOpenConversation}
    >
      <header className="homepage__header">
        <div className="homepage__brand">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#4f3ef5"
            strokeWidth="2.2"
          >
            <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5Z" />
          </svg>

          <span className="homepage__brand-name">AI Learning</span>
        </div>

        <div className="homepage__header-actions">
          <button className="homepage__icon-btn" title="Settings">
            <i className="bi bi-gear"></i>
          </button>

          <button className="homepage__icon-btn" title="Notifications">
            <i className="bi bi-bell-fill"></i>
          </button>

          {currentUser ? (
            <UserAvatar user={currentUser} onLogout={handleLogout} />
          ) : (
            <AuthButton onLoginSuccess={handleLoginSuccess} />
          )}
        </div>
      </header>

      <div className="homepage__document-box">
        <label className="homepage__document-label">Teacher Materials</label>

        <select
          className="homepage__document-select"
          value={documentId}
          onChange={handleSelectTeacherDocument}
        >
          <option value="">Choose teacher document</option>

          {teacherDocuments.map((doc) => (
            <option key={doc.documentId} value={doc.documentId}>
              {doc.fileName}
            </option>
          ))}
        </select>

        {selectedDocumentName && (
          <p className="homepage__document-current">
            Using: {selectedDocumentName}
          </p>
        )}
      </div>

      <div className="homepage__body">
        {chat.length === 0 ? (
          <div className="homepage__welcome">
            <SparkleIcon />

            <h1 className="homepage__title">Where should we start?</h1>

            <p className="homepage__subtitle">
              Ask me anything — I am here to help you learn and explore ideas.
            </p>

            {selectedDocumentName && (
              <p style={{ color: "#16a34a", fontWeight: 600 }}>
                Current document: {selectedDocumentName}
              </p>
            )}
          </div>
        ) : (
          <div
            style={{
              width: "100%",
              padding: "24px 40px",
              overflowY: "auto",
            }}
          >
            {chat.map((item, index) => (
              <div
                key={index}
                style={{
                  display: "flex",
                  justifyContent:
                    item.role === "user" ? "flex-end" : "flex-start",
                  marginBottom: "14px",
                }}
              >
                <div
                  style={{
                    maxWidth: "70%",
                    padding: "12px 16px",
                    borderRadius: "14px",
                    background: item.role === "user" ? "#4f3ef5" : "#f3f4f6",
                    color: item.role === "user" ? "#fff" : "#111827",
                    lineHeight: "1.6",
                  }}
                >
                  {item.content}
                </div>
              </div>
            ))}

            {loading && <p>Processing...</p>}
          </div>
        )}
      </div>

      <div className="homepage__input-bar">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.xlsx,.xls"
          style={{ display: "none" }}
          onChange={handleUploadPDF}
        />

        <button
          className="homepage__tool-btn"
          onClick={handleUploadClick}
          disabled={loading}
          title="Upload File"
        >
          <i className="bi bi-paperclip"></i>
        </button>

        <button className="homepage__tool-btn" disabled={loading}>
          <i className="bi bi-mic"></i>
        </button>

        <input
          className="homepage__input"
          type="text"
          placeholder={
            documentId
              ? "Ask something about selected document..."
              : "Upload a file or choose teacher document first..."
          }
          value={message}
          disabled={loading}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSendMessage();
          }}
        />

        <button
          className={`homepage__send-btn ${
            message.trim() ? "homepage__send-btn--active" : ""
          }`}
          onClick={handleSendMessage}
          disabled={loading}
        >
          ➤
        </button>
      </div>
    </ChatLayout>
  );
};

export default HomePage;