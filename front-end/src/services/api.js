export const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3000";

const buildQuery = (params = {}) => {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      searchParams.append(key, value);
    }
  });

  const query = searchParams.toString();
  return query ? `?${query}` : "";
};

async function parseJsonResponse(res) {
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(
      data.message || data.error || data.detail || "Request failed",
    );
  }

  return data;
}

async function requestJson(path, options = {}) {
  const { method = "GET", body, headers = {} } = options;

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  return parseJsonResponse(res);
}

async function requestForm(path, formData, options = {}) {
  const { method = "POST" } = options;

  const res = await fetch(`${API_URL}${path}`, {
    method,
    body: formData,
  });

  return parseJsonResponse(res);
}

/* =========================
   UPLOAD
========================= */

export async function uploadFile(file, options = {}) {
  const formData = new FormData();

  formData.append("file", file);

  const fields = [
    "uploadedBy",
    "uploaderId",
    "duplicateAction",
    "replaceDocumentId",
    "subjectId",
    "topicId",
    "documentTypeId",
    "levelId",
    "tags",
    "summary",
  ];

  fields.forEach((field) => {
    if (options[field]) {
      formData.append(field, options[field]);
    }
  });

  if (options.allowVersion) {
    formData.append("allowVersion", "true");
  }

  return requestForm("/upload", formData);
}

export async function uploadTeacherFile(file, uploaderId, options = {}) {
  return uploadFile(file, {
    ...options,
    uploadedBy: "teacher",
    uploaderId,
  });
}

export async function replaceReportedDocument(report, file, teacherId, options = {}) {
  return uploadTeacherFile(file, teacherId, {
    duplicateAction: "replace_old",
    replaceDocumentId: report.documentId,
    subjectId: report.subjectId,
    topicId: report.topicId,
    documentTypeId: report.documentTypeId,
    levelId: report.levelId,
    tags: report.tags,
    summary: report.summary,
    ...options,
  });
}

/* =========================
   AUTH / ADMIN
========================= */

export async function createTeacherAccount(fullName, email) {
  return requestJson("/auth/admin/create-teacher", {
    method: "POST",
    body: {
      fullName,
      email,
    },
  });
}

/* =========================
   USERS
========================= */

export async function getUsers() {
  return requestJson("/users");
}

export async function getDashboardStats() {
  return requestJson("/users/stats");
}

export async function getUserProfile(userId) {
  return requestJson(`/users/${userId}/profile`);
}

export async function updateUserProfile(userId, payload) {
  return requestJson(`/users/${userId}/profile`, {
    method: "PUT",
    body: payload,
  });
}

export async function uploadAvatar(userId, file) {
  const formData = new FormData();
  formData.append("avatar", file);

  return requestForm(`/users/${userId}/avatar`, formData);
}

export async function changePassword(userId, currentPassword, newPassword) {
  return requestJson(`/users/${userId}/password`, {
    method: "PUT",
    body: {
      currentPassword,
      newPassword,
    },
  });
}

export async function updateUserStatus(userId, status) {
  return requestJson(`/users/${userId}/status`, {
    method: "PUT",
    body: {
      status,
    },
  });
}

export async function updateUserRole(userId, role) {
  return requestJson(`/users/${userId}/role`, {
    method: "PUT",
    body: {
      role,
    },
  });
}

export async function deleteUser(userId) {
  return requestJson(`/users/${userId}`, {
    method: "DELETE",
  });
}

export async function getUserOverview(userId) {
  return requestJson(`/users/${userId}/overview`);
}

export async function getUserDocuments(userId) {
  return requestJson(`/users/${userId}/documents`);
}

/* =========================
   DOCUMENTS
========================= */

export async function getDocuments() {
  return requestJson("/documents");
}

export async function getDocumentDetail(documentId) {
  return requestJson(`/documents/${documentId}/detail`);
}

export async function deleteDocument(documentId) {
  return requestJson(`/documents/${documentId}`, {
    method: "DELETE",
  });
}

export async function getLibraryDocuments(userId, role, filters = {}) {
  return requestJson(
    `/documents/library${buildQuery({
      userId,
      role,
      subjectId: filters.subjectId,
      topicId: filters.topicId,
    })}`,
  );
}

export async function getTeacherUploadHistory(teacherId) {
  return requestJson(
    teacherId
      ? `/documents/teacher-history?uploaderId=${teacherId}`
      : "/documents/teacher-history",
  );
}

export async function getTeacherStats() {
  return requestJson("/documents/teacher-stats");
}

export async function updateDocumentMetadata(documentId, payload) {
  return requestJson(`/documents/${documentId}/metadata`, {
    method: "PUT",
    body: payload,
  });
}

export async function publishDocument(documentId, userId) {
  return requestJson(`/documents/${documentId}/publish`, {
    method: "PUT",
    body: {
      userId,
    },
  });
}

/* =========================
   DOCUMENT METADATA
========================= */

export async function getMetadata() {
  return requestJson("/documents/metadata");
}

export async function getSubjects() {
  return requestJson("/documents/subjects");
}

export async function createSubject(payload) {
  return requestJson("/documents/subjects", {
    method: "POST",
    body: payload,
  });
}

export async function updateSubject(subjectId, payload) {
  return requestJson(`/documents/subjects/${subjectId}`, {
    method: "PUT",
    body: payload,
  });
}

export async function getTopics(subjectId) {
  return requestJson(`/documents/topics${buildQuery({ subjectId })}`);
}

export async function createTopic(payload) {
  return requestJson("/documents/topics", {
    method: "POST",
    body: payload,
  });
}

export async function updateTopic(topicId, payload) {
  return requestJson(`/documents/topics/${topicId}`, {
    method: "PUT",
    body: payload,
  });
}

export async function getDocumentTypes() {
  return requestJson("/documents/document-types");
}

export async function createDocumentType(payload) {
  return requestJson("/documents/document-types", {
    method: "POST",
    body: payload,
  });
}

export async function getDocumentLevels() {
  return requestJson("/documents/document-levels");
}

export async function createDocumentLevel(payload) {
  return requestJson("/documents/document-levels", {
    method: "POST",
    body: payload,
  });
}

/* =========================
   CHAT
========================= */

export async function sendMessage(
  payloadOrDocumentId,
  message,
  approvedAnswers = [],
  responseLanguage = "vi",
  sessionId = null,
) {
  const payload =
    typeof payloadOrDocumentId === "object" && payloadOrDocumentId !== null
      ? payloadOrDocumentId
      : {
          documentId: payloadOrDocumentId,
          message,
          approvedAnswers,
          responseLanguage,
          sessionId,
        };

  return requestJson("/chat", {
    method: "POST",
    body: payload,
  });
}

export async function getChatSessions(userId) {
  return requestJson(`/chat-history/sessions/${userId}`);
}

export async function createChatSession(userId, documentId, title, documentIds) {
  return requestJson("/chat-history/sessions", {
    method: "POST",
    body: {
      userId,
      documentId,
      documentIds,
      title,
    },
  });
}

export async function getChatMessages(sessionId) {
  return requestJson(`/chat-history/messages/${sessionId}`);
}

export async function saveChatMessage(
  sessionId,
  sender,
  message,
  options = {},
) {
  return requestJson("/chat-history/messages", {
    method: "POST",
    body: {
      sessionId,
      sender,
      message,
      sourceExcerpt: options.sourceExcerpt || null,
      sourceDocumentName: options.sourceDocumentName || null,
    },
  });
}


export async function updateChatMessageApproved(messageId, isApproved) {
  return requestJson(`/chat-history/messages/${messageId}/approved`, {
    method: "PUT",
    body: {
      isApproved,
    },
  });
}

export async function updateChatSession(sessionId, data) {
  return requestJson(`/chat-history/sessions/${sessionId}`, {
    method: "PUT",
    body: data,
  });
}


export async function updateChatSessionStarred(sessionId, isStarred) {
  return requestJson(`/chat-history/sessions/${sessionId}/starred`, {
    method: "PUT",
    body: {
      isStarred,
    },
  });
}

export async function deleteChatSession(sessionId) {
  return requestJson(`/chat-history/sessions/${sessionId}`, {
    method: "DELETE",
  });
}

/* =========================
   FEEDBACK
========================= */

export async function getStudentSubmissions() {
  return requestJson("/feedback/submissions");
}

export async function generateStudentFeedback(studentId, teacherId, documentId) {
  return requestJson("/feedback/generate", {
    method: "POST",
    body: {
      studentId,
      teacherId,
      documentId,
    },
  });
}

export async function askStudentFeedback(studentId, documentId, question) {
  return requestJson("/feedback/ask", {
    method: "POST",
    body: {
      studentId,
      documentId,
      question,
    },
  });
}

/* =========================
   NOTIFICATIONS
========================= */

export async function getNotifications(userId) {
  return requestJson(`/notifications/${userId}`);
}

export async function getUnreadNotificationCount(userId) {
  return requestJson(`/notifications/${userId}/unread-count`);
}

export async function markNotificationAsRead(notificationId) {
  return requestJson(`/notifications/${notificationId}/read`, {
    method: "PUT",
  });
}

export async function markAllNotificationsAsRead(userId) {
  return requestJson(`/notifications/user/${userId}/read-all`, {
    method: "PUT",
  });
}
/* =========================
   MESSAGE REPORTS
========================= */

export async function reportMessage(payload) {
  return requestJson("/reports/message", {
    method: "POST",
    body: payload,
  });
}

export async function getTeacherMessageReports(teacherId, filters = {}) {
  return requestJson(
    `/reports/teacher/${teacherId}${buildQuery({
      status: filters.status,
      role: filters.role,
    })}`,
  );
}

export async function updateMessageReportStatus(reportId, payload) {
  return requestJson(`/reports/${reportId}/status`, {
    method: "PUT",
    body: payload,
  });
}
