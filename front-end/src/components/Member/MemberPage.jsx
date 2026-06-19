import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { logout } from "../../services/authService";
import {
  getUserProfile,
  getChatSessions,
  createChatSession,
  deleteChatSession,
  getDocuments,
  updateChatSession,
} from "../../services/api";

import ChatLayout from "../Layout/ChatLayout";
import UserAvatar from "./UserAvatar";
import ChatArea from "./ChatArea";
import "./Member.scss";

const MemberPage = () => {
  const navigate = useNavigate();
  const { username, conversationId } = useParams();

  const [user, setUser] = useState(() =>
    JSON.parse(
      localStorage.getItem("currentUser") ||
        sessionStorage.getItem("currentUser") ||
        "null",
    ),
  );

  const userId = user?.userId;

  const [conversations, setConversations] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [availableDocuments, setAvailableDocuments] = useState([]);
  const [selectedDocument, setSelectedDocument] = useState(null);

  const activeId = conversationId || conversations[0]?.id || null;

  const activeConversation = conversations.find(
    (item) => String(item.id) === String(activeId),
  );

  useEffect(() => {
    if (!userId) {
      navigate("/");
      return;
    }

    const checkStatus = async () => {
      try {
        const result = await getUserProfile(userId);

        if (result.success && result.user?.status === "blocked") {
          localStorage.removeItem("currentUser");
          sessionStorage.removeItem("currentUser");
          sessionStorage.setItem(
            "blockedMessage",
            "Tài khoản của bạn đã bị admin chặn.",
          );

          setUser(null);
          navigate("/", { replace: true });
        }
      } catch (error) {
        console.log("Cannot check user status:", error);
      }
    };

    checkStatus();

    const timer = setInterval(checkStatus, 5000);

    return () => clearInterval(timer);
  }, [userId, navigate]);

  useEffect(() => {
    const loadSessions = async () => {
      if (!userId) return;

      try {
        setLoadingSessions(true);

        const data = await getChatSessions(userId);
        const sessions = Array.isArray(data) ? data : [];

        setConversations(sessions);

        if (!conversationId && sessions.length > 0) {
          navigate(`/u/${username}/chat/${sessions[0].id}`);
        }
      } catch (error) {
        console.log("Cannot load chat sessions:", error);
      } finally {
        setLoadingSessions(false);
      }
    };

    loadSessions();
  }, [userId, conversationId, navigate, username]);

  useEffect(() => {
    const loadDocuments = async () => {
      if (!userId) return;

      try {
        const result = await getDocuments();
        const docs = Array.isArray(result) ? result : result?.data || [];

        const filteredDocs = docs.filter((doc) => {
          const isOwnDocument = String(doc.uploaderId) === String(userId);

          const isApprovedTeacherDocument =
            doc.uploadedBy === "teacher" && doc.reviewStatus === "approved";

          return isOwnDocument || isApprovedTeacherDocument;
        });

        const uniqueDocs = filteredDocs.filter(
          (doc, index, arr) =>
            index ===
            arr.findIndex(
              (item) => String(item.documentId) === String(doc.documentId),
            ),
        );

        setAvailableDocuments(uniqueDocs);
      } catch (error) {
        console.log("Cannot load documents:", error);
      }
    };

    loadDocuments();
  }, [userId]);

  useEffect(() => {
    if (!activeConversation?.documentId) {
      setSelectedDocument(null);
      return;
    }

    const foundDoc = availableDocuments.find(
      (doc) => String(doc.documentId) === String(activeConversation.documentId),
    );

    setSelectedDocument({
      documentId: activeConversation.documentId,
      fileName:
        foundDoc?.fileName ||
        activeConversation.fileName ||
        "Uploaded document",
    });
  }, [
    activeConversation?.documentId,
    activeConversation?.fileName,
    availableDocuments,
  ]);

  const handleSelect = (id) => {
    navigate(`/u/${username}/chat/${id}`);
  };

  const handleNew = async () => {
    if (!userId) return;

    try {
      const result = await createChatSession(userId, null, "New Chat");
      const newId = String(result.sessionId || result.id);

      const newConv = {
        id: newId,
        sessionId: result.sessionId || newId,
        userId,
        documentId: null,
        title: "New Chat",
        preview: "",
        date: "Today",
        messageCount: 0,
        starred: false,
      };

      setConversations((prev) => [newConv, ...prev]);
      setSelectedDocument(null);
      navigate(`/u/${username}/chat/${newId}`);
    } catch (error) {
      console.log("Cannot create chat session:", error);
    }
  };

  const handleDeleteSession = async (id) => {
    try {
      await deleteChatSession(id);

      let nextConversations = [];

      setConversations((prev) => {
        nextConversations = prev.filter(
          (item) => String(item.id) !== String(id),
        );
        return nextConversations;
      });

      if (String(activeId) === String(id)) {
        const nextSession = nextConversations[0];

        if (nextSession) {
          navigate(`/u/${username}/chat/${nextSession.id}`);
        } else {
          setSelectedDocument(null);
          navigate(`/u/${username}/chat`);
        }
      }
    } catch (error) {
      console.log("Cannot delete chat session:", error);
    }
  };

  const handleConversationUpdated = (updated) => {
    setConversations((prev) =>
      prev.map((item) =>
        String(item.id) === String(updated.id) ? { ...item, ...updated } : item,
      ),
    );
  };

  const handleSelectDocumentFromLibrary = async (doc) => {
    if (!doc || !userId) return;

    const selected = {
      documentId: doc.documentId,
      fileName: doc.fileName,
    };

    setSelectedDocument(selected);

    if (!activeId) {
      const result = await createChatSession(
        userId,
        doc.documentId,
        doc.fileName || "New Chat",
      );

      const newId = String(result.sessionId || result.id);

      const newConv = {
        id: newId,
        sessionId: result.sessionId || newId,
        userId,
        documentId: doc.documentId,
        fileName: doc.fileName,
        title: doc.fileName || "New Chat",
        preview: `Đang hỏi theo file: ${doc.fileName}`,
        date: "Today",
        messageCount: 0,
        starred: false,
      };

      setConversations((prev) => [newConv, ...prev]);
      navigate(`/u/${username}/chat/${newId}`);
      return;
    }

    await updateChatSession(activeId, {
      documentId: doc.documentId,
    });

    handleConversationUpdated({
      id: activeId,
      documentId: doc.documentId,
      fileName: doc.fileName,
      preview: `Đang hỏi theo file: ${doc.fileName}`,
    });
  };

  const handleUserUpdated = (updatedUser) => {
    setUser(updatedUser);

    if (localStorage.getItem("currentUser")) {
      localStorage.setItem("currentUser", JSON.stringify(updatedUser));
    }

    if (sessionStorage.getItem("currentUser")) {
      sessionStorage.setItem("currentUser", JSON.stringify(updatedUser));
    }
  };

  const handleLogout = () => {
    logout();
    localStorage.removeItem("currentUser");
    sessionStorage.clear();
    navigate("/");
  };

  return (
    <ChatLayout
      conversations={conversations}
      setConversations={setConversations}
      activeId={activeId}
      onSelect={handleSelect}
      onNew={handleNew}
      onDelete={handleDeleteSession}
      currentUser={user}
      documents={availableDocuments}
      selectedDocument={selectedDocument}
      onSelectDocument={handleSelectDocumentFromLibrary}
      headerRight={
        <UserAvatar
          user={user}
          onLogout={handleLogout}
          onUserUpdated={handleUserUpdated}
        />
      }
    >
      {loadingSessions ? (
        <div className="member-chat__body">
          <p>Đang tải lịch sử chat...</p>
        </div>
      ) : (
        <ChatArea
          conversationId={activeId}
          user={user}
          activeConversation={activeConversation}
          onConversationUpdated={handleConversationUpdated}
          selectedDocument={selectedDocument}
          setSelectedDocument={setSelectedDocument}
          setAvailableDocuments={setAvailableDocuments}
        />
      )}
    </ChatLayout>
  );
};

export default MemberPage;