import { useState } from "react";

export default function UploadMaterials() {
  const [dragOver, setDragOver] = useState(false);

  return (
    <div
      className={`td-upload-zone ${dragOver ? "td-upload-zone--active" : ""}`}
      onClick={() => document.getElementById("td-file-input").click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
      }}
    >
      <div className="td-upload-icon">📤</div>
      <div className="td-upload-title">Click to upload or drag &amp; drop</div>
      <div className="td-upload-sub">PDF, DOCX, PPTX — max 20 MB</div>

      <input
        id="td-file-input"
        type="file"
        accept=".pdf,.docx,.pptx"
        style={{ display: "none" }}
      />
    </div>
  );
}