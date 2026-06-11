import React, { useState } from "react";
import "./Sidebar.scss";
import SearchBox from "./SearchBox";
import NewReflectionButton from "./NewReflectionButton";

const Sidebar = ({ conversations = [], activeId, onSelect, onNew, onToggleStar }) => {
  const [search, setSearch] = useState("");

  const filtered = conversations.filter((c) =>
    c.title?.toLowerCase().includes(search.toLowerCase())
  );

  const starred = filtered.filter((c) => c.starred);
  const recent = filtered.filter((c) => !c.starred);

  const renderItem = (conv) => (
    <div
      key={conv.id}
      className={[
        "sidebar__item",
        conv.id === activeId ? "sidebar__item--active" : "",
        conv.starred ? "sidebar__item--starred" : "",
      ].join(" ")}
      onClick={() => onSelect?.(conv.id)}
    >
      <div className="sidebar__item-body">
        <div className="sidebar__item-top">
          <span className="sidebar__item-date">{conv.date || "Today"}</span>
          <span
            className={`sidebar__item-badge ${conv.starred ? "sidebar__item-badge--starred" : ""}`}
          >
            {conv.starred && <i className="ti ti-star-filled sidebar__item-badge-icon"></i>}
            +{conv.messageCount || 0}
          </span>
        </div>
        <div className="sidebar__item-title">{conv.title}</div>
        <div className="sidebar__item-preview">{conv.preview || ""}</div>
      </div>

      {/* Nút star */}
      <button
        className={`sidebar__item-star ${conv.starred ? "sidebar__item-star--on" : ""}`}
        title={conv.starred ? "Unstar" : "Star"}
        onClick={(e) => {
          e.stopPropagation();
          onToggleStar?.(conv.id);
        }}
      >
        <i className={conv.starred ? "ti ti-star-filled" : "ti ti-star"}></i>
      </button>
    </div>
  );

  return (
    <aside className="sidebar">
      {/* Header */}
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
        <SearchBox
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search"
        />
      </div>

      {/* List */}
      <div className="sidebar__list">
        {filtered.length === 0 ? (
          <div className="sidebar__empty">
            <i className="ti ti-message-off sidebar__empty-icon"></i>
            <p>No conversations yet</p>
          </div>
        ) : (
          <>
            {/* Starred group */}
            {starred.length > 0 && (
              <>
                <div className="sidebar__group-label">
                  <i className="ti ti-star-filled"></i>
                  Starred
                </div>
                {starred.map(renderItem)}
              </>
            )}

            {/* Recent group */}
            {recent.length > 0 && (
              <>
                <div className="sidebar__group-label">
                  Last 30 days
                </div>
                {recent.map(renderItem)}
              </>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="sidebar__footer">
        <NewReflectionButton onClick={onNew} />
      </div>
    </aside>
  );
};

export default Sidebar;