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
    throw new Error(data.message || data.error || data.detail || "Request failed");
  }

  return data;
}

export async function uploadFile(file, options = {}) {
  const formData = new FormData();

  formData.append("file", file);

  if (options.uploadedBy) formData.append("uploadedBy", options.uploadedBy);
  if (options.uploaderId) formData.append("uploaderId", options.uploaderId);

  if (options.allowVersion) formData.append("allowVersion", "true");
  if (options.duplicateAction) {
    formData.append("duplicateAction", options.duplicateAction);
  }
  if (options.replaceDocumentId) {
    formData.append("replaceDocumentId", options.replaceDocumentId);
  }

  if (options.subjectId) formData.append("subjectId", options.subjectId);
  if (options.topicId) formData.append("topicId", options.topicId);
  if (options.documentTypeId) {
    formData.append("documentTypeId", options.documentTypeId);
  }
  if (options.levelId) formData.append("levelId", options.levelId);
  if (options.tags) formData.append("tags", options.tags);
  if (options.summary) formData.append("summary", options.summary);

  const res = await fetch(`${API_URL}/upload`, {
    method: "POST",
    body: formData,
  });

  return res.json();
}

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

  const res = await fetch(`${API_URL}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return res.json();
}

export async function uploadTeacherFile(file, uploaderId, options = {}) {
  return uploadFile(file, {
    ...options,
    uploadedBy: "teacher",
    uploaderId,
  });
}

export async function getMetadata() {
  const res = await fetch(`${API_URL}/documents/metadata`);
  return parseJsonResponse(res);
}

export async function getSubjects() {
  const res = await fetch(`${API_URL}/documents/subjects`);
  return parseJsonResponse(res);
}

export async function createSubject(payload) {
  const res = await fetch(`${API_URL}/documents/subjects`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return parseJsonResponse(res);
}

export async function updateSubject(subjectId, payload) {
  const res = await fetch(`${API_URL}/documents/subjects/${subjectId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return parseJsonResponse(res);
}

export async function getTopics(subjectId) {
  const res = await fetch(
    `${API_URL}/documents/topics${buildQuery({ subjectId })}`,
  );

  return parseJsonResponse(res);
}

export async function createTopic(payload) {
  const res = await fetch(`${API_URL}/documents/topics`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return parseJsonResponse(res);
}

export async function updateTopic(topicId, payload) {
  const res = await fetch(`${API_URL}/documents/topics/${topicId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return parseJsonResponse(res);
}

export async function getDocumentTypes() {
  const res = await fetch(`${API_URL}/documents/document-types`);
  return parseJsonResponse(res);
}

export async function createDocumentType(payload) {
  const res = await fetch(`${API_URL}/documents/document-types`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return parseJsonResponse(res);
}

export async function getDocumentLevels() {
  const res = await fetch(`${API_URL}/documents/document-levels`);
  return parseJsonResponse(res);
}

export async function createDocumentLevel(payload) {
  const res = await fetch(`${API_URL}/documents/document-levels`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return parseJsonResponse(res);
}

export async function updateDocumentMetadata(documentId, payload) {
  const res = await fetch(`${API_URL}/documents/${documentId}/metadata`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return parseJsonResponse(res);
}

export async function getTeacherDocuments() {
  const res = await fetch(`${API_URL}/documents`);
  return res.json();
}

export async function getTeacherUploadHistory(teacherId) {
  const url = teacherId
    ? `${API_URL}/documents/teacher-history?uploaderId=${teacherId}`
    : `${API_URL}/documents/teacher-history`;

  const res = await fetch(url);

  if (!res.ok) {
    throw new Error("Cannot load teacher upload history");
  }

  return res.json();
}

export async function getUsers() {
  const res = await fetch(`${API_URL}/users`);

  if (!res.ok) {
    throw new Error("Cannot load users");
  }

  return res.json();
}

export async function updateUserStatus(userId, status) {
  const res = await fetch(`${API_URL}/users/${userId}/status`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status }),
  });

  if (!res.ok) {
    throw new Error("Cannot update user status");
  }

  return res.json();
}

export async function updateUserRole(userId, role) {
  const res = await fetch(`${API_URL}/users/${userId}/role`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ role }),
  });

  if (!res.ok) {
    throw new Error("Cannot update user role");
  }

  return res.json();
}

export async function deleteUser(userId) {
  const res = await fetch(`${API_URL}/users/${userId}`, {
    method: "DELETE",
  });

  return res.json();
}

export async function getChatSessions(userId) {
  const res = await fetch(`${API_URL}/chat-history/sessions/${userId}`);
  return res.json();
}

export async function createChatSession(userId, documentId, title, documentIds) {
  const res = await fetch(`${API_URL}/chat-history/sessions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      userId,
      documentId,
      documentIds,
      title,
    }),
  });

  return res.json();
}

export async function getChatMessages(sessionId) {
  const res = await fetch(`${API_URL}/chat-history/messages/${sessionId}`);
  return res.json();
}

export async function saveChatMessage(sessionId, sender, message) {
  const res = await fetch(`${API_URL}/chat-history/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sessionId,
      sender,
      message,
    }),
  });

  return res.json();
}

export async function updateChatSession(sessionId, data) {
  const res = await fetch(`${API_URL}/chat-history/sessions/${sessionId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  return res.json();
}

export async function deleteChatSession(sessionId) {
  const res = await fetch(`${API_URL}/chat-history/sessions/${sessionId}`, {
    method: "DELETE",
  });

  return res.json();
}

export async function getDocuments() {
  const res = await fetch(`${API_URL}/documents`);
  return res.json();
}

export async function getLibraryDocuments(userId, role, filters = {}) {
  const res = await fetch(
    `${API_URL}/documents/library${buildQuery({
      userId,
      role,
      subjectId: filters.subjectId,
      topicId: filters.topicId,
    })}`,
  );

  return res.json();
}

export async function uploadAvatar(userId, file) {
  const formData = new FormData();

  formData.append("avatar", file);

  const res = await fetch(`${API_URL}/users/${userId}/avatar`, {
    method: "POST",
    body: formData,
  });

  return res.json();
}

export async function getTeacherStats() {
  const res = await fetch(`${API_URL}/documents/teacher-stats`);

  if (!res.ok) {
    throw new Error("Cannot load teacher stats");
  }

  return res.json();
}

export async function deleteDocument(documentId) {
  const res = await fetch(`${API_URL}/documents/${documentId}`, {
    method: "DELETE",
  });

  return res.json();
}

export async function getDashboardStats() {
  const res = await fetch(`${API_URL}/users/stats`);
  return res.json();
}

export async function createTeacherAccount(fullName, email) {
  const res = await fetch(`${API_URL}/auth/admin/create-teacher`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fullName,
      email,
    }),
  });

  return res.json();
}

export async function getStudentSubmissions() {
  const res = await fetch(`${API_URL}/feedback/submissions`);
  return res.json();
}

export async function generateStudentFeedback(studentId, teacherId, documentId) {
  const res = await fetch(`${API_URL}/feedback/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      studentId,
      teacherId,
      documentId,
    }),
  });

  return res.json();
}

export async function askStudentFeedback(studentId, documentId, question) {
  const res = await fetch(`${API_URL}/feedback/ask`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      studentId,
      documentId,
      question,
    }),
  });

  return res.json();
}

export async function getNotifications(userId) {
  const res = await fetch(`${API_URL}/notifications/${userId}`);
  return res.json();
}

export async function getUnreadNotificationCount(userId) {
  const res = await fetch(`${API_URL}/notifications/${userId}/unread-count`);
  return res.json();
}

export async function markNotificationAsRead(notificationId) {
  const res = await fetch(`${API_URL}/notifications/${notificationId}/read`, {
    method: "PUT",
  });

  return res.json();
}

export async function markAllNotificationsAsRead(userId) {
  const res = await fetch(`${API_URL}/notifications/user/${userId}/read-all`, {
    method: "PUT",
  });

  return res.json();
}

export async function getUserProfile(userId) {
  const res = await fetch(`${API_URL}/users/${userId}/profile`);
  return res.json();
}