export const API_URL = import.meta.env.VITE_API_URL;

export async function uploadFile(file, options = {}) {
  const formData = new FormData();

  formData.append("file", file);

  if (options.uploadedBy) {
    formData.append("uploadedBy", options.uploadedBy);
  }

  if (options.uploaderId) {
    formData.append("uploaderId", options.uploaderId);
  }

  if (options.allowVersion) {
    formData.append("allowVersion", "true");
  }

  const res = await fetch(`${API_URL}/upload`, {
    method: "POST",
    body: formData,
  });

  return res.json();
}

export async function sendMessage(documentId, message, approvedAnswers = []) {
  const res = await fetch(`${API_URL}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      documentId,
      message,
      approvedAnswers,
    }),
  });

  return res.json();
}

export async function uploadTeacherFile(file, uploaderId, options = {}) {
  return uploadFile(file, {
    uploadedBy: "teacher",
    uploaderId,
    allowVersion: options.allowVersion,
  });
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
  const response = await fetch(`http://localhost:3000/users/${userId}`, {
    method: "DELETE",
  });

  return await response.json();
}

export async function getChatSessions(userId) {
  const res = await fetch(`${API_URL}/chat-history/sessions/${userId}`);
  return res.json();
}

export async function createChatSession(userId, documentId, title) {
  const res = await fetch(`${API_URL}/chat-history/sessions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      userId,
      documentId,
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
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fullName, email }),
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
