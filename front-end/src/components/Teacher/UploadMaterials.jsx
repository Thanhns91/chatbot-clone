import { useState } from "react";
import Card from "react-bootstrap/Card";

export default function UploadMaterials() {
  const [dragOver, setDragOver] = useState(false);

  return (
    <Card
      className={`td-upload-zone border-0 ${dragOver ? "td-upload-zone--active" : ""}`}
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
      <Card.Body className="d-flex flex-column align-items-center gap-3 py-5">
        <div className="td-upload-icon">
          <i className="ti ti-cloud-upload"></i>
        </div>
        <Card.Text className="td-upload-title mb-0">
          Click to upload or drag &amp; drop
        </Card.Text>
        <Card.Text className="td-upload-sub mb-0">
          PDF, DOCX, PPTX — max 20 MB
        </Card.Text>
        <input
          id="td-file-input"
          type="file"
          accept=".pdf,.docx,.pptx"
          style={{ display: "none" }}
        />
      </Card.Body>
    </Card>
  );
}
