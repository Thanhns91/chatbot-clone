import React, { useState } from "react";
import "./Sidebar.scss";
import SearchBox from "./SearchBox";
import NewReflectionButton from "./NewReflectionButton";

const Sidebar = ({
  conversations = [],
  activeId,
  onSelect,
  onNew,
  onToggleStar,
  onDelete,
}) => {
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);

  const filtered = conversations.filter((c) =>
    c.title?.toLowerCase().includes(search.toLowerCase()),
  );

  const starred = filtered.filter((c) => c.starred);
  const recent = filtered.filter((c) => !c.starred);

  const openDeleteModal = (conv) => {
    setDeleteTarget(conv);
  };

  const closeDeleteModal = () => {
    setDeleteTarget(null);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;

    onDelete?.(deleteTarget.id);
    setDeleteTarget(null);
  };

  const renderItem = (conv) => (
    <div
      key={conv.id}
      className={[
        "sidebar__item",
        String(conv.id) === String(activeId) ? "sidebar__item--active" : "",
        conv.starred ? "sidebar__item--starred" : "",
      ].join(" ")}
      onClick={() => onSelect?.(conv.id)}
    >
      <div className="sidebar__item-body">
        <div className="sidebar__item-top">
          <span className="sidebar__item-date">{conv.date || "Today"}</span>

          <span
            className={`sidebar__item-badge ${
              conv.starred ? "sidebar__item-badge--starred" : ""
            }`}
          >
            {conv.starred && (
              <i className="ti ti-star-filled sidebar__item-badge-icon"></i>
            )}
            +{conv.messageCount || 0}
          </span>
        </div>

        <div className="sidebar__item-title">{conv.title || "New Chat"}</div>
        <div className="sidebar__item-preview">{conv.preview || ""}</div>
      </div>

      <div className="sidebar__item-actions">
        <button
          className={`sidebar__item-star ${
            conv.starred ? "sidebar__item-star--on" : ""
          }`}
          title={conv.starred ? "Unstar" : "Star"}
          onClick={(e) => {
            e.stopPropagation();
            onToggleStar?.(conv.id);
          }}
        >
          <i className={conv.starred ? "ti ti-star-filled" : "ti ti-star"}></i>
        </button>

        <button
          className="sidebar__item-star sidebar__item-delete"
          title="Delete"
          onClick={(e) => {
            e.stopPropagation();
            openDeleteModal(conv);
          }}
        >
          <i className="ti ti-trash"></i>
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside className="sidebar">
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

        <div className="sidebar__list">
          {filtered.length === 0 ? (
            <div className="sidebar__empty">
              <i className="ti ti-message-off sidebar__empty-icon"></i>
              <p>No conversations yet</p>
            </div>
          ) : (
            <>
              {starred.length > 0 && (
                <>
                  <div className="sidebar__group-label">
                    <i className="ti ti-star-filled"></i>
                    Starred
                  </div>
                  {starred.map(renderItem)}
                </>
              )}

              {recent.length > 0 && (
                <>
                  <div className="sidebar__group-label">Last 30 days</div>
                  {recent.map(renderItem)}
                </>
              )}
            </>
          )}
        </div>

        <div className="sidebar__footer">
          <NewReflectionButton onClick={onNew} />
        </div>
      </aside>

      {deleteTarget && (
        <div className="sidebar-delete-modal">
          <div
            className="sidebar-delete-modal__backdrop"
            onClick={closeDeleteModal}
          />

          <div className="sidebar-delete-modal__box">
            <div className="sidebar-delete-modal__icon">
              <i className="ti ti-trash"></i>
            </div>

            <h3 className="sidebar-delete-modal__title">Xóa đoạn chat này?</h3>

            <p className="sidebar-delete-modal__text">
              Đoạn chat <strong>{deleteTarget.title || "New Chat"}</strong> sẽ
              bị xóa khỏi lịch sử. Hành động này không thể hoàn tác.
            </p>

            <div className="sidebar-delete-modal__actions">
              <button
                className="sidebar-delete-modal__btn sidebar-delete-modal__btn--cancel"
                onClick={closeDeleteModal}
              >
                Hủy
              </button>

              <button
                className="sidebar-delete-modal__btn sidebar-delete-modal__btn--danger"
                onClick={confirmDelete}
              >
                Xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;
