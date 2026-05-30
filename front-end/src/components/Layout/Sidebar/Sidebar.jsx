import React from "react";
import "./Sidebar.css";
import SearchBox from "./SearchBox";
import NewReflectionButton from "./NewReflectionButton";

const Sidebar = ({ conversations = [], activeId, onSelect, onNew }) => {
  return (
    <aside className="sidebar">

      {/* Header: icon + tiêu đề + search */}
      <div className="sidebar__header">
        <div className="sidebar__title-row">
          <div className="sidebar__title-icon">
            <i className="ti ti-history"></i>
          </div>
          <div>
            <p className="sidebar__title">History</p>
            <p className="sidebar__subtitle">of reflection</p>
          </div>
        </div>
        <SearchBox />
      </div>

      {/* Danh sách cuộc hội thoại */}
      <div className="sidebar__list">
        {conversations.length === 0 ? (
          <div className="sidebar__empty">
            <i className="ti ti-message-off sidebar__empty-icon"></i>
            <p>No conversations yet</p>
          </div>
        ) : (
          conversations.map((conv) => (
            <div
              key={conv.id}
              className={`sidebar__item ${conv.id === activeId ? "sidebar__item--active" : ""}`}
              onClick={() => onSelect?.(conv.id)}
            >
              <i className="ti ti-message me-2"></i>
              {conv.title}
            </div>
          ))
        )}
      </div>

      {/* Nút tạo chat mới */}
      <div className="sidebar__footer">
        <NewReflectionButton onClick={onNew} />
      </div>

    </aside>
  );
};

export default Sidebar;