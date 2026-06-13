import React from "react";
import Card from "react-bootstrap/Card";
import Button from "react-bootstrap/Button";
import ListGroup from "react-bootstrap/ListGroup";

const uploadHistory = [
  {
    name: "Algebra_Unit4_Notes.pdf",
    date: "Jun 1, 2026",
    size: "2.1 MB",
    type: "pdf",
  },
  {
    name: "Intro_to_Calculus.mp4",
    date: "May 28, 2026",
    size: "48 MB",
    type: "mp4",
  },
  {
    name: "Quiz_3_Instructions.docx",
    date: "May 22, 2026",
    size: "340 KB",
    type: "docx",
  },
];

const fileIcon = (type) => {
  if (type === "pdf")
    return { cls: "td-file-icon--pdf", icon: "bi bi-file-earmark-pdf" };
  if (type === "mp4")
    return { cls: "td-file-icon--mp4", icon: "bi bi-file-earmark-play" };
  return { cls: "td-file-icon--docx", icon: "bi bi-file-earmark-word" };
};

const MaterialsTab = () => {
  return (
    <>
      {/* Upload zone */}
      <Card className="td-upload-zone border-0">
        <Card.Body className="d-flex flex-column align-items-center gap-3 py-5">
          <div className="td-upload-icon">
            <i className="bi bi-upload"></i>
          </div>
          <Card.Text className="td-upload-text mb-0">
            Drop files here or click to browse
          </Card.Text>
          <Card.Text className="td-upload-hint mb-0">
            PDF, DOCX, PPTX, MP4 · max 100MB
          </Card.Text>
          <Button variant="primary" className="td-select-btn">
            Select Files
          </Button>
        </Card.Body>
      </Card>

      {/* Upload history */}
      <Card className="td-card">
        <Card.Body>
          <div className="td-section-label">Upload History</div>
          <ListGroup variant="flush">
            {uploadHistory.map((f, i) => {
              const { cls, icon } = fileIcon(f.type);
              return (
                <ListGroup.Item key={i} className="td-file-item px-0">
                  <div className={`td-file-icon ${cls}`}>
                    <i className={icon}></i>
                  </div>
                  <div>
                    <div className="td-file-name">{f.name}</div>
                    <div className="td-file-meta">
                      {f.date} · {f.size}
                    </div>
                  </div>
                </ListGroup.Item>
              );
            })}
          </ListGroup>
        </Card.Body>
      </Card>
    </>
  );
};

export default MaterialsTab;
