import React from "react";

const uploadHistory = [
  { name: "Algebra_Unit4_Notes.pdf",  date: "Jun 1, 2026",  size: "2.1 MB",  type: "pdf"  },
  { name: "Intro_to_Calculus.mp4",    date: "May 28, 2026", size: "48 MB",   type: "mp4"  },
  { name: "Quiz_3_Instructions.docx", date: "May 22, 2026", size: "340 KB",  type: "docx" },
];

const fileIcon = (type) => {
  if (type === "pdf")  return { cls: "td-file-icon--pdf",  icon: "bi bi-file-earmark-pdf" };
  if (type === "mp4")  return { cls: "td-file-icon--mp4",  icon: "bi bi-file-earmark-play" };
  return                      { cls: "td-file-icon--docx", icon: "bi bi-file-earmark-word" };
};

const MaterialsTab = () => {
  return (
    <>
      {/* Upload zone */}
      <div className="td-upload-zone">
        <div className="td-upload-icon">
          <i className="bi bi-upload"></i>
        </div>
        <p className="td-upload-text">Drop files here or click to browse</p>
        <p className="td-upload-hint">PDF, DOCX, PPTX, MP4 · max 100MB</p>
        <button className="td-select-btn">Select Files</button>
      </div>

      {/* Upload history */}
      <div className="td-card">
        <div className="td-section-label">Upload History</div>
        {uploadHistory.map((f, i) => {
          const { cls, icon } = fileIcon(f.type);
          return (
            <div key={i} className="td-file-item">
              <div className={`td-file-icon ${cls}`}>
                <i className={icon}></i>
              </div>
              <div>
                <div className="td-file-name">{f.name}</div>
                <div className="td-file-meta">{f.date} · {f.size}</div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
};

export default MaterialsTab;