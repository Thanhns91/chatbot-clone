import { useEffect, useMemo, useRef, useState } from "react";
import Form from "react-bootstrap/Form";
import Modal from "react-bootstrap/Modal";
import Button from "react-bootstrap/Button";
import logo7 from "../../assets/images/7.png";
import {
  uploadFile,
  sendMessage,
  getChatMessages,
  saveChatMessage,
  updateChatSession,
  getMetadata,
} from "../../services/api";
import "./Member.scss";

const makeId = () => {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return String(Date.now() + Math.random());
};

const defaultUploadMeta = {
  subjectId: "",
  topicId: "",
  documentTypeId: "",
  levelId: "",
  tags: "",
  summary: "",
};

const ChatArea = ({
  conversationId,
  user,
  activeConversation,
  onConversationUpdated,
  selectedDocument,
  setSelectedDocument,
  setAvailableDocuments,
}) => {
  const fileInputRef = useRef(null);

  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [approvedAnswers, setApprovedAnswers] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [toast, setToast] = useState(null);

  const [pendingUploadFile, setPendingUploadFile] = useState(null);
  const [showUploadMetaModal, setShowUploadMetaModal] = useState(false);
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [subjects, setSubjects] = useState([]);
  const [topics, setTopics] = useState([]);
  const [documentTypes, setDocumentTypes] = useState([]);
  const [documentLevels, setDocumentLevels] = useState([]);
  const [uploadMeta, setUploadMeta] = useState(defaultUploadMeta);

  const showToast = (type, title, message = "") => {
    const toastId = Date.now();

    setToast({
      id: toastId,
      type,
      title,
      message,
    });

    setTimeout(() => {
      setToast((current) => {
        if (current?.id === toastId) return null;
        return current;
      });
    }, 3200);
  };

  const filteredTopics = useMemo(() => {
    if (!uploadMeta.subjectId) return topics;

    return topics.filter(
      (topic) => String(topic.subjectId) === String(uploadMeta.subjectId),
    );
  }, [topics, uploadMeta.subjectId]);

  const loadMetadata = async () => {
    try {
      setMetadataLoading(true);
      const data = await getMetadata();

      if (data.success) {
        setSubjects(data.subjects || []);
        setTopics(data.topics || []);
        setDocumentTypes(data.documentTypes || []);
        setDocumentLevels(data.documentLevels || []);
      }
    } catch (error) {
      console.log("Cannot load metadata:", error);
      showToast("error", "Cannot load metadata", error.message);
    } finally {
      setMetadataLoading(false);
    }
  };

  useEffect(() => {
    const loadMessages = async () => {
      if (!conversationId) {
        setMessages([]);
        setSelectedDocument?.(null);
        setApprovedAnswers([]);
        return;
      }

      try {
        setLoadingMessages(true);

        const data = await getChatMessages(conversationId);

        let lastUserQuestion = "";

        const formatted = Array.isArray(data)
          ? data
              .filter((item) => item.sender !== "system")
              .map((item) => {
                const msg = {
                  id: item.messageId,
                  role: item.sender,
                  content: item.message,
                  approved: false,
                  question: "",
                };

                if (item.sender === "user") {
                  lastUserQuestion = item.message;
                }

                if (item.sender === "ai") {
                  msg.question = lastUserQuestion;
                }

                return msg;
              })
          : [];

        setMessages(formatted);

        if (activeConversation?.documentId) {
          setSelectedDocument?.({
            documentId: activeConversation.documentId,
            fileName: activeConversation.fileName || "Uploaded document",
          });
        }

        setApprovedAnswers([]);
      } catch (error) {
        console.log("Cannot load messages:", error);
      } finally {
        setLoadingMessages(false);
      }
    };

    loadMessages();
  }, [
    conversationId,
    activeConversation?.documentId,
    activeConversation?.fileName,
    setSelectedDocument,
  ]);

  const handleChooseFile = async () => {
    if (!conversationId) {
      alert("Bạn cần tạo New Chat trước khi upload tài liệu.");
      return;
    }

    await loadMetadata();
    fileInputRef.current?.click();
  };

  const resetUploadMetaModal = () => {
    setPendingUploadFile(null);
    setShowUploadMetaModal(false);
    setUploadMeta(defaultUploadMeta);
  };

  const handleOpenPendingFile = (file) => {
    if (!file) return;

    const fileUrl = URL.createObjectURL(file);
    window.open(fileUrl, "_blank", "noopener,noreferrer");

    setTimeout(() => {
      URL.revokeObjectURL(fileUrl);
    }, 30000);
  };

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];

    if (!file || !conversationId) return;

    setPendingUploadFile(file);
    setUploadMeta(defaultUploadMeta);
    setShowUploadMetaModal(true);

    event.target.value = "";
  };

  const findById = (list, idKey, idValue) => {
    if (!idValue) return null;

    return list.find((item) => String(item[idKey]) === String(idValue));
  };

  const buildUploadedDocument = (result, uploadedBy) => {
    const subjectId = result.subjectId || uploadMeta.subjectId;
    const topicId = result.topicId || uploadMeta.topicId;
    const documentTypeId = result.documentTypeId || uploadMeta.documentTypeId;
    const levelId = result.levelId || uploadMeta.levelId;

    const subject = findById(subjects, "subjectId", subjectId);
    const topic = findById(topics, "topicId", topicId);
    const documentType = findById(
      documentTypes,
      "documentTypeId",
      documentTypeId,
    );
    const level = findById(documentLevels, "levelId", levelId);
    
    return {
      documentId: result.documentId,
      fileName: result.fileName,
      fileType: result.fileType,
      fileUrl: result.fileUrl,
      totalChunks: result.totalChunks,

      uploaderId: user?.userId,
      uploadedBy,

      reviewStatus:
        result.reviewStatus ||
        (uploadedBy === "teacher" ? "approved" : "private"),

      subjectId,
      topicId,
      documentTypeId,
      levelId,

      tags: result.tags || uploadMeta.tags,
      summary: result.summary || uploadMeta.summary,

      subjectCode: result.subjectCode || subject?.subjectCode || "",
      subjectName: result.subjectName || subject?.subjectName || "",
      topicName: result.topicName || topic?.topicName || "Uncategorized",
      documentTypeName: result.documentTypeName || documentType?.typeName || "",
      levelName: result.levelName || level?.levelName || "",

      versionNo: result.versionNo || 1,
      versionGroupId: result.versionGroupId,
      vectorDocumentId: result.vectorDocumentId,
      isDuplicate: Boolean(result.isDuplicate || result.duplicate),
      uploadDate: result.uploadDate || new Date().toISOString(),
    };
  };

  const doUpload = async (extraOptions = {}) => {
    const uploadedBy = user?.role === "teacher" ? "teacher" : "student";

    return uploadFile(pendingUploadFile, {
      uploadedBy,
      uploaderId: user?.userId,
      subjectId: uploadMeta.subjectId,
      topicId: uploadMeta.topicId,
      documentTypeId: uploadMeta.documentTypeId,
      levelId: uploadMeta.levelId,
      tags: uploadMeta.tags,
      summary: uploadMeta.summary,
      ...extraOptions,
    });
  };

  const handleConfirmUpload = async () => {
    if (!pendingUploadFile || !conversationId) return;

    try {
      setUploading(true);

      let result = await doUpload();

      if (result.needConfirm) {
        const saveAsVersion = window.confirm(
          `${result.message || "File already exists."}\n\nOK = Save as new version\nCancel = Replace old file`,
        );

        result = await doUpload({
          duplicateAction: saveAsVersion ? "new_version" : "replace_old",
          replaceDocumentId: result.existingDocumentId,
        });
      }

      if (result.error || result.success === false) {
        throw new Error(result.detail || result.message || result.error);
      }

      await updateChatSession(conversationId, {
        documentId: result.documentId,
      });

      const uploadedBy = user?.role === "teacher" ? "teacher" : "student";
      const uploadedDocument = buildUploadedDocument(result, uploadedBy);

      setSelectedDocument?.(uploadedDocument);

      setAvailableDocuments?.((prev) => {
        const existed = prev.some(
          (item) => String(item.documentId) === String(result.documentId),
        );

        if (existed) return prev;

        return [uploadedDocument, ...prev];
      });

      if (result.replacedOld) {
        showToast("success", "File replaced", result.fileName);
      } else if (result.duplicate) {
        showToast(
          "success",
          "File already exists!",
          `Saved as Version ${result.versionNo || 2} in your library.`,
        );
      } else {
        showToast("success", "Upload successful!");
      }

      onConversationUpdated?.({
        id: conversationId,
        documentId: result.documentId,
        fileName: result.fileName,
        preview: result.duplicate
          ? `Saved as Version ${result.versionNo || 2}: ${result.fileName}`
          : result.fileName,
        messageCount: (activeConversation?.messageCount || 0) + 1,
      });

      resetUploadMetaModal();
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: makeId(),
          role: "system",
          content: `Upload thất bại: ${error.message}`,
        },
      ]);
    } finally {
      setUploading(false);
    }
  };

  const handleSend = async () => {
    const userText = message.trim();

    if (!userText || loading || !conversationId) return;

    if (!selectedDocument?.documentId) {
      setMessages((prev) => [
        ...prev,
        {
          id: makeId(),
          role: "ai",
          content:
            "Bạn cần chọn tài liệu trong Library hoặc upload tài liệu trước, sau đó mình mới có thể trả lời theo file đó.",
          approved: false,
        },
      ]);
      return;
    }

    const userMessage = {
      id: makeId(),
      role: "user",
      content: userText,
    };

    setMessages((prev) => [...prev, userMessage]);
    setMessage("");
    setLoading(true);

    try {
      await saveChatMessage(conversationId, "user", userText);

      const oldMessageCount = activeConversation?.messageCount || 0;

      const shouldRename =
        !activeConversation?.title || activeConversation.title === "New Chat";

      const newTitle =
        userText.length > 45 ? `${userText.slice(0, 45)}...` : userText;

      if (shouldRename) {
        await updateChatSession(conversationId, {
          title: newTitle,
        });
      }

      const result = await sendMessage(
        selectedDocument.documentId,
        userText,
        approvedAnswers,
      );

      const aiAnswer = result.answer || "Không có phản hồi.";

      await saveChatMessage(conversationId, "ai", aiAnswer);

      const aiMessage = {
        id: makeId(),
        role: "ai",
        content: aiAnswer,
        question: userText,
        approved: false,
        outOfScope: result.outOfScope || false,
        evidence: result.evidence || [],
      };

      setMessages((prev) => [...prev, aiMessage]);

      onConversationUpdated?.({
        id: conversationId,
        title: shouldRename ? newTitle : activeConversation?.title,
        preview: aiAnswer,
        messageCount: oldMessageCount + 2,
      });
    } catch (error) {
      const errorText = `Lỗi khi gọi AI: ${error.message}`;

      setMessages((prev) => [
        ...prev,
        {
          id: makeId(),
          role: "ai",
          content: errorText,
          approved: false,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleApproved = (aiMessage) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === aiMessage.id ? { ...msg, approved: !msg.approved } : msg,
      ),
    );

    setApprovedAnswers((prev) => {
      const existed = prev.some((item) => item.id === aiMessage.id);

      if (existed) {
        return prev.filter((item) => item.id !== aiMessage.id);
      }

      return [
        ...prev,
        {
          id: aiMessage.id,
          question: aiMessage.question || "",
          answer: aiMessage.content,
        },
      ];
    });
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx"
        hidden
        onChange={handleUpload}
      />

      <Modal
        show={showUploadMetaModal}
        onHide={() => {
          if (!uploading) resetUploadMetaModal();
        }}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Document metadata</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <div className="mb-3">
            <div className="d-flex align-items-center justify-content-between gap-2">
              <p className="text-muted mb-0">
                File: <b>{pendingUploadFile?.name}</b>
              </p>

              <Button
                type="button"
                variant="outline-primary"
                size="sm"
                onClick={() => handleOpenPendingFile(pendingUploadFile)}
                disabled={!pendingUploadFile}
              >
                <i className="bi bi-box-arrow-up-right me-1" />
                Open file
              </Button>
            </div>

            <p className="text-muted mb-0 mt-1">
              Leave fields empty to let the system auto-fill metadata.
            </p>
          </div>

          {metadataLoading && <p className="text-muted">Loading metadata...</p>}

          <Form.Group className="mb-3">
            <Form.Label>Subject</Form.Label>
            <Form.Select
              value={uploadMeta.subjectId}
              onChange={(e) =>
                setUploadMeta((prev) => ({
                  ...prev,
                  subjectId: e.target.value,
                  topicId: "",
                }))
              }
            >
              <option value="">Auto-fill subject</option>
              {subjects.map((subject) => (
                <option key={subject.subjectId} value={subject.subjectId}>
                  {subject.subjectCode
                    ? `${subject.subjectCode} - ${subject.subjectName}`
                    : subject.subjectName}
                </option>
              ))}
            </Form.Select>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Topic</Form.Label>
            <Form.Select
              value={uploadMeta.topicId}
              onChange={(e) =>
                setUploadMeta((prev) => ({
                  ...prev,
                  topicId: e.target.value,
                }))
              }
              disabled={!uploadMeta.subjectId}
            >
              <option value="">Auto-fill topic</option>
              {filteredTopics.map((topic) => (
                <option key={topic.topicId} value={topic.topicId}>
                  {topic.topicName}
                </option>
              ))}
            </Form.Select>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Document Type</Form.Label>
            <Form.Select
              value={uploadMeta.documentTypeId}
              onChange={(e) =>
                setUploadMeta((prev) => ({
                  ...prev,
                  documentTypeId: e.target.value,
                }))
              }
            >
              <option value="">Auto-fill type</option>
              {documentTypes.map((type) => (
                <option key={type.documentTypeId} value={type.documentTypeId}>
                  {type.typeName}
                </option>
              ))}
            </Form.Select>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Level</Form.Label>
            <Form.Select
              value={uploadMeta.levelId}
              onChange={(e) =>
                setUploadMeta((prev) => ({
                  ...prev,
                  levelId: e.target.value,
                }))
              }
            >
              <option value="">Auto-fill level</option>
              {documentLevels.map((level) => (
                <option key={level.levelId} value={level.levelId}>
                  {level.levelName}
                </option>
              ))}
            </Form.Select>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Tags</Form.Label>
            <Form.Control
              value={uploadMeta.tags}
              placeholder="example: rag, week 1, assignment"
              onChange={(e) =>
                setUploadMeta((prev) => ({
                  ...prev,
                  tags: e.target.value,
                }))
              }
            />
          </Form.Group>

          <Form.Group>
            <Form.Label>Tên/Ghi chú tài liệu</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={uploadMeta.summary}
              placeholder="Ví dụ: Bài tập RAG của Khang / ghi chú ngắn"
              onChange={(e) =>
                setUploadMeta((prev) => ({
                  ...prev,
                  summary: e.target.value,
                }))
              }
            />
          </Form.Group>
        </Modal.Body>

        <Modal.Footer>
          <Button
            variant="secondary"
            disabled={uploading}
            onClick={resetUploadMetaModal}
          >
            Cancel
          </Button>

          <Button
            variant="primary"
            disabled={uploading}
            onClick={handleConfirmUpload}
          >
            {uploading ? "Uploading..." : "Upload"}
          </Button>
        </Modal.Footer>
      </Modal>

      {toast && (
        <div className={`member-toast member-toast--${toast.type}`}>
          <div className="member-toast__main">
            <div className="member-toast__icon">
              {toast.type === "success" && <i className="ti ti-check"></i>}
              {toast.type === "error" && <i className="ti ti-x"></i>}
              {toast.type === "warning" && (
                <i className="ti ti-alert-circle"></i>
              )}
              {toast.type === "info" && <i className="ti ti-loader-2"></i>}
            </div>

            <div className="member-toast__content">
              <strong>{toast.title}</strong>
              {toast.message && <span>{toast.message}</span>}
            </div>

            <button
              className="member-toast__close"
              type="button"
              onClick={() => setToast(null)}
            >
              <i className="ti ti-x"></i>
            </button>
          </div>

          <div className="member-toast__progress" />
        </div>
      )}

      <div className="member-chat__body">
        {loadingMessages ? (
          <p>Đang tải tin nhắn...</p>
        ) : messages.length === 0 ? (
          <div className="member-chat__welcome">
            <img src={logo7} alt="logo" className="member-chat__logo" />
            <h1 className="member-chat__title">Where should we start?</h1>
            <p className="member-chat__subtitle">
              Upload tài liệu hoặc mở Library để chọn file, sau đó hỏi AI dựa
              trên nội dung trong file.
            </p>
          </div>
        ) : (
          <div className="member-chat__messages">
            {selectedDocument && (
              <div className="member-chat__document-info">
                <i className="ti ti-file-text" />
                <span>
                  Đang hỏi theo file: <b>{selectedDocument.fileName}</b>
                </span>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`member-chat__message-row member-chat__message-row--${msg.role}`}
              >
                {msg.role !== "system" && (
                  <div className="member-chat__sender">
                    {msg.role === "user" ? "You" : "AI Learning"}
                  </div>
                )}

                <div
                  className={`member-chat__bubble member-chat__bubble--${msg.role}`}
                >
                  {msg.content}

                  {msg.role === "ai" && (
                    <button
                      className={`member-chat__approve-btn ${
                        msg.approved ? "member-chat__approve-btn--active" : ""
                      }`}
                      title="Đánh dấu câu trả lời này phù hợp"
                      onClick={() => handleToggleApproved(msg)}
                    >
                      <i className="ti ti-check" />
                    </button>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="member-chat__message-row member-chat__message-row--ai">
                <div className="member-chat__sender">AI Learning</div>
                <div className="member-chat__bubble member-chat__bubble--ai">
                  Đang đọc tài liệu...
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="member-chat__input-bar">
        <button
          className="member-chat__tool-btn member-chat__tool-btn--attach"
          title="Upload tài liệu"
          onClick={handleChooseFile}
          disabled={uploading || loading}
        >
          <i className="ti ti-paperclip" />
        </button>

        <button
          className="member-chat__tool-btn member-chat__tool-btn--mic"
          title="Voice input"
          type="button"
        >
          <i className="ti ti-microphone" />
        </button>

        <Form.Control
          className="member-chat__input"
          type="text"
          placeholder={
            selectedDocument
              ? `Hỏi nội dung trong ${selectedDocument.fileName}...`
              : "Chọn file trong Library hoặc upload tài liệu trước..."
          }
          value={message}
          disabled={uploading || loading}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSend();
          }}
        />

        <button
          className={`member-chat__send-btn ${
            message.trim() ? "member-chat__send-btn--active" : ""
          }`}
          onClick={handleSend}
          disabled={uploading || loading}
        >
          <i className="ti ti-send" />
        </button>
      </div>
    </>
  );
};

export default ChatArea;
