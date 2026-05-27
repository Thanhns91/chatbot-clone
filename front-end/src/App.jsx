import { useState } from "react";
import "./App.css";
import { uploadFile, sendMessage } from "./services/api";

function App() {
  const [file, setFile] = useState(null);
  const [documentId, setDocumentId] = useState("");
  const [message, setMessage] = useState("");
  const [chat, setChat] = useState([]);
  const [loading, setLoading] = useState(false);

  async function handleUpload() {
    if (!file) {
      alert("Vui lòng chọn file PDF");
      return;
    }

    setLoading(true);

    try {
      const data = await uploadFile(file);

      console.log("UPLOAD RESPONSE:", data);

      if (!data.documentId) {
        alert("Upload lỗi");
        return;
      }

      setDocumentId(data.documentId);

      alert(
        `Upload thành công: ${data.totalChunks || 0} chunks`
      );
    } catch (error) {
      console.error(error);
      alert("Lỗi upload file");
    } finally {
      setLoading(false);
    }
  }

  async function handleSend() {
    if (!message.trim()) return;

    if (!documentId) {
      alert("Bạn cần upload tài liệu trước");
      return;
    }

    const userMsg = message;

    setMessage("");

    setChat((prev) => [
      ...prev,
      {
        role: "user",
        content: userMsg,
      },
    ]);

    setLoading(true);

    try {
      const data = await sendMessage(
        documentId,
        userMsg
      );

      console.log("CHAT RESPONSE:", data);

      setChat((prev) => [
        ...prev,
        {
          role: "bot",
          content: data.answer || "Không có phản hồi",
        },
      ]);
    } catch (error) {
      console.error(error);

      setChat((prev) => [
        ...prev,
        {
          role: "bot",
          content: "Lỗi khi chat",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container">
      <h1>RAG Chatbot Demo</h1>

      <div className="upload-box">
        <h2>Upload tài liệu PDF</h2>

        <input
          type="file"
          accept="application/pdf"
          onChange={(e) =>
            setFile(e.target.files[0])
          }
        />

        <button
          onClick={handleUpload}
          disabled={loading}
        >
          Upload
        </button>

        {documentId && (
          <p>
            <b>Document ID:</b> {documentId}
          </p>
        )}
      </div>

      <div className="chat-box">
        <h2>Chat với tài liệu</h2>

        <div className="messages">
          {chat.map((item, index) => (
            <div
              key={index}
              className={
                item.role === "user"
                  ? "user-msg"
                  : "bot-msg"
              }
            >
              <b>
                {item.role === "user"
                  ? "Bạn"
                  : "Bot"}
                :
              </b>

              <p>{item.content}</p>
            </div>
          ))}
        </div>

        <div className="input-row">
          <input
            value={message}
            placeholder="Nhập câu hỏi..."
            onChange={(e) =>
              setMessage(e.target.value)
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleSend();
              }
            }}
          />

          <button
            onClick={handleSend}
            disabled={loading}
          >
            Gửi
          </button>
        </div>

        {loading && <p>Đang xử lý...</p>}
      </div>
    </div>
  );
}

export default App;