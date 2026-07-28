import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { logout } from "../../services/authService";

import {
  getUserProfile,
  getChatSessions,
  createChatSession,
  deleteChatSession,
  getLibraryDocuments,
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

  /* =========================================================
     KIỂM TRA TRẠNG THÁI TÀI KHOẢN
  ========================================================= */

  useEffect(() => {
    if (!userId) {
      navigate("/");
      return undefined;
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

          navigate("/", {
            replace: true,
          });
        }
      } catch (error) {
        console.log("Cannot check user status:", error);
      }
    };

    checkStatus();

    const timer = setInterval(checkStatus, 5000);

    return () => {
      clearInterval(timer);
    };
  }, [userId, navigate]);

  /* =========================================================
     TẢI DANH SÁCH CHAT
  ========================================================= */

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

  /* =========================================================
     TẢI LIBRARY

     Student nhìn thấy:
     - Tài liệu Teacher đã approved
     - Tất cả tài liệu do chính Student upload
     - Bao gồm file Student đang Private
  ========================================================= */

  const loadDocuments = useCallback(async () => {
    if (!userId) {
      setAvailableDocuments([]);
      return [];
    }

    try {
      const result = await getLibraryDocuments(userId, user?.role || "student");

      const documents = Array.isArray(result) ? result : result?.data || [];

      const filteredDocuments = documents.filter((document) => {
        const isOwnDocument = String(document.uploaderId) === String(userId);

        const isApprovedTeacherDocument =
          document.uploadedBy === "teacher" &&
          document.reviewStatus === "approved";

        return isOwnDocument || isApprovedTeacherDocument;
      });

      const uniqueDocuments = filteredDocuments.filter(
        (document, index, documentArray) =>
          index ===
          documentArray.findIndex(
            (item) => String(item.documentId) === String(document.documentId),
          ),
      );

      setAvailableDocuments(uniqueDocuments);

      return uniqueDocuments;
    } catch (error) {
      console.log("Cannot load library documents:", error);

      return [];
    }
  }, [userId, user]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  /* =========================================================
     ĐỒNG BỘ FILE ĐANG ĐƯỢC CHAT SỬ DỤNG
  ========================================================= */

  useEffect(() => {
    if (!activeConversation?.documentId) {
      setSelectedDocument(null);
      return;
    }

    const foundDocument = availableDocuments.find(
      (document) =>
        String(document.documentId) === String(activeConversation.documentId),
    );

    setSelectedDocument({
      documentId: activeConversation.documentId,

      fileName:
        foundDocument?.fileName ||
        activeConversation.fileName ||
        "Uploaded document",

      uploadedBy:
        foundDocument?.uploadedBy || activeConversation.uploadedBy || null,

      reviewStatus:
        foundDocument?.reviewStatus || activeConversation.reviewStatus || null,

      versionNo: foundDocument?.versionNo || activeConversation.versionNo || 1,

      versionGroupId:
        foundDocument?.versionGroupId ||
        activeConversation.versionGroupId ||
        null,
    });
  }, [
    activeConversation?.documentId,
    activeConversation?.fileName,
    activeConversation?.uploadedBy,
    activeConversation?.reviewStatus,
    activeConversation?.versionNo,
    activeConversation?.versionGroupId,
    availableDocuments,
  ]);

  /* =========================================================
     CHỌN CHAT
  ========================================================= */

  const handleSelect = (id) => {
    navigate(`/u/${username}/chat/${id}`);
  };

  /* =========================================================
     TẠO CHAT MỚI
  ========================================================= */

  const handleNew = async () => {
    if (!userId) return;

    try {
      const result = await createChatSession(userId, null, "New Chat");

      const newId = String(result.sessionId || result.id);

      const newConversation = {
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

      setConversations((previousConversations) => [
        newConversation,
        ...previousConversations,
      ]);

      setSelectedDocument(null);

      navigate(`/u/${username}/chat/${newId}`);
    } catch (error) {
      console.log("Cannot create chat session:", error);
    }
  };

  /* =========================================================
     XÓA CHAT
  ========================================================= */

  const handleDeleteSession = async (id) => {
    try {
      await deleteChatSession(id);

      let nextConversations = [];

      setConversations((previousConversations) => {
        nextConversations = previousConversations.filter(
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

  /* =========================================================
     CẬP NHẬT CHAT TRÊN GIAO DIỆN
  ========================================================= */

  const handleConversationUpdated = (updatedConversation) => {
    setConversations((previousConversations) =>
      previousConversations.map((conversation) =>
        String(conversation.id) === String(updatedConversation.id)
          ? {
              ...conversation,
              ...updatedConversation,
            }
          : conversation,
      ),
    );
  };

  /* =========================================================
     CHỌN FILE TỪ LIBRARY
  ========================================================= */

  const handleSelectDocumentFromLibrary = async (document) => {
    if (!document || !userId) {
      return;
    }

    try {
      const selected = {
        documentId: document.documentId,

        fileName: document.fileName,

        uploadedBy: document.uploadedBy || null,

        reviewStatus: document.reviewStatus || null,

        versionNo: document.versionNo || 1,

        versionGroupId: document.versionGroupId || null,
      };

      setSelectedDocument(selected);

      if (!activeId) {
        const result = await createChatSession(
          userId,
          document.documentId,
          document.fileName || "New Chat",
        );

        const newId = String(result.sessionId || result.id);

        const newConversation = {
          id: newId,

          sessionId: result.sessionId || newId,

          userId,

          documentId: document.documentId,

          fileName: document.fileName,

          uploadedBy: document.uploadedBy || null,

          reviewStatus: document.reviewStatus || null,

          versionNo: document.versionNo || 1,

          versionGroupId: document.versionGroupId || null,

          title: document.fileName || "New Chat",

          preview: `Đang hỏi theo file: ${document.fileName}`,

          date: "Today",
          messageCount: 0,
          starred: false,
        };

        setConversations((previousConversations) => [
          newConversation,
          ...previousConversations,
        ]);

        navigate(`/u/${username}/chat/${newId}`);

        return;
      }

      await updateChatSession(activeId, {
        documentId: document.documentId,
      });

      handleConversationUpdated({
        id: activeId,

        documentId: document.documentId,

        fileName: document.fileName,

        uploadedBy: document.uploadedBy || null,

        reviewStatus: document.reviewStatus || null,

        versionNo: document.versionNo || 1,

        versionGroupId: document.versionGroupId || null,

        preview: `Đang hỏi theo file: ${document.fileName}`,
      });
    } catch (error) {
      console.log("Cannot select document:", error);
    }
  };

  /* =========================================================
     CẬP NHẬT THÔNG TIN USER
  ========================================================= */

  const handleUserUpdated = (updatedUser) => {
    setUser(updatedUser);

    if (localStorage.getItem("currentUser")) {
      localStorage.setItem("currentUser", JSON.stringify(updatedUser));
    }

    if (sessionStorage.getItem("currentUser")) {
      sessionStorage.setItem("currentUser", JSON.stringify(updatedUser));
    }
  };

  /* =========================================================
     ĐĂNG XUẤT
  ========================================================= */

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
      onDocumentsChanged={loadDocuments}
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
          onDocumentsRefresh={loadDocuments}
        />
      )}
    </ChatLayout>
  );
};

export default MemberPage;
