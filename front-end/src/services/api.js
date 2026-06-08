const API_URL = "http://localhost:3000";

export async function uploadFile(file) {
  const formData = new FormData();

  formData.append("file", file);

  const res = await fetch(`${API_URL}/upload`, {
    method: "POST",
    body: formData,
  });

  return res.json();
}

export async function sendMessage(documentId, message) {
  const res = await fetch(`${API_URL}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      documentId,
      message,
    }),
  });

  return res.json();
}

export async function uploadTeacherFile(file) {
  const formData = new FormData();

  formData.append("file", file);
  formData.append("uploadedBy", "teacher");

  const res = await fetch(`${API_URL}/upload`, {
    method: "POST",
    body: formData,
  });

  return res.json();
}

export async function getTeacherDocuments() {
  const res = await fetch(`${API_URL}/documents`);

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
  const response = await fetch(
    `http://localhost:3000/users/${userId}`,
    {
      method: "DELETE",
    }
  );

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