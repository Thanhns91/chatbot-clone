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

export async function sendMessage(
  documentId,
  message
) {
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