import React from "react";
import Button from "react-bootstrap/Button";
import "./LibraryPanel.scss";

const MOCK_LESSONS = [
  { id: 1, icon: "📘", color: "purple", title: "Introduction to Machine Learning", category: "Computer Science", pages: 42, date: "May 20" },
  { id: 2, icon: "📗", color: "green",  title: "Linear Algebra Fundamentals",      category: "Mathematics",       pages: 68, date: "May 18" },
  { id: 3, icon: "📙", color: "yellow", title: "Python for Data Science",           category: "Programming",       pages: 55, date: "May 15" },
  { id: 4, icon: "📕", color: "blue",   title: "Quantum Mechanics Basics",          category: "Physics",           pages: 90, date: "May 10" },
  { id: 5, icon: "📒", color: "pink",   title: "Cell Biology & Genetics",           category: "Biology",           pages: 73, date: "May 5"  },
  { id: 6, icon: "📔", color: "gray",   title: "History of Modern Science",         category: "History",           pages: 48, date: "Apr 28" },
];

const LibraryPanel = ({ open, onClose, lessons = MOCK_LESSONS }) => {
  return (
    <div className={`library-panel ${open ? "library-panel--open" : ""}`}>
      <div className="library-panel__inner">

        {/* Header */}
        <div className="library-panel__header">
          <div className="library-panel__title">
            <i className="bi bi-book"></i>
            Library
          </div>
          <Button
            variant="light"
            className="library-panel__close"
            onClick={onClose}
            title="Close"
          >
            <i className="bi bi-x-lg"></i>
          </Button>
        </div>

        <div className="library-panel__count">{lessons.length} LESSONS AVAILABLE</div>

        {/* Lesson list */}
        <div className="library-panel__list">
          {lessons.map((lesson) => (
            <div key={lesson.id} className="lesson-card">
              <div className="lesson-card__top">
                <div className={`lesson-card__icon lesson-card__icon--${lesson.color}`}>
                  {lesson.icon}
                </div>
                <div className="lesson-card__info">
                  <div className="lesson-card__title">{lesson.title}</div>
                  <div className="lesson-card__category">{lesson.category}</div>
                </div>
              </div>

              <div className="lesson-card__meta">
                {lesson.pages} pages &nbsp;·&nbsp; {lesson.date}
              </div>

              <div className="lesson-card__actions">
                <Button
                  variant="outline-secondary"
                  className="lesson-card__btn-open"
                >
                  <i className="bi bi-box-arrow-up-right me-1"></i>
                  Open
                </Button>
                <Button
                  variant="primary"
                  className="lesson-card__btn-ask"
                >
                  <i className="bi bi-chat-dots me-1"></i>
                  Ask AI
                </Button>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
};

export default LibraryPanel;