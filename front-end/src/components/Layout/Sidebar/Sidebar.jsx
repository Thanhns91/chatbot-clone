import React, { useState } from "react";
import { toast } from "react-toastify";

import "./Sidebar.scss";

import SearchBox from "./SearchBox";
import NewReflectionButton from "./NewReflectionButton";

const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:3000";

const Sidebar = ({
  conversations = [],
  activeId,
  onSelect,
  onNew,
  onToggleStar,
  onDelete,
  appVersion = "1.0.0",
  collapsed = false,
  onToggleCollapse,
}) => {
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] =
    useState(null);
  const [savingStarId, setSavingStarId] =
    useState(null);

  const filtered = conversations.filter(
    (conversation) =>
      conversation.title
        ?.toLowerCase()
        .includes(search.toLowerCase()),
  );

  const starred = filtered.filter(
    (conversation) => conversation.starred,
  );

  const recent = filtered.filter(
    (conversation) => !conversation.starred,
  );

  const openDeleteModal = (
    conversation,
  ) => {
    setDeleteTarget(conversation);
  };

  const closeDeleteModal = () => {
    setDeleteTarget(null);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;

    onDelete?.(deleteTarget.id);
    setDeleteTarget(null);
  };

  const handleToggleStar = async (
    conversation,
  ) => {
    const nextStarred =
      !conversation.starred;

    try {
      setSavingStarId(
        conversation.id,
      );

      const response = await fetch(
        `${API_URL}/chat-history/sessions/${conversation.id}/starred`,
        {
          method: "PUT",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            isStarred: nextStarred,
          }),
        },
      );

      const data = await response
        .json()
        .catch(() => ({}));

      if (
        !response.ok ||
        data.success === false
      ) {
        throw new Error(
          data.message ||
            data.detail ||
            "Cannot save starred status",
        );
      }

      onToggleStar?.(
        conversation.id,
        nextStarred,
      );
    } catch (error) {
      console.log(
        "Cannot save starred status:",
        error,
      );

      toast.error(
        error.message ||
          "Không thể lưu trạng thái ngôi sao.",
      );
    } finally {
      setSavingStarId(null);
    }
  };

  const renderItem = (
    conversation,
  ) => (
    <div
      key={conversation.id}
      className={[
        "sidebar__item",

        String(conversation.id) ===
        String(activeId)
          ? "sidebar__item--active"
          : "",

        conversation.starred
          ? "sidebar__item--starred"
          : "",
      ].join(" ")}
      onClick={() =>
        onSelect?.(conversation.id)
      }
    >
      <div className="sidebar__item-body">
        <div className="sidebar__item-top">
          <span className="sidebar__item-date">
            {conversation.date ||
              "Today"}
          </span>

          <span
            className={`sidebar__item-badge ${
              conversation.starred
                ? "sidebar__item-badge--starred"
                : ""
            }`}
          >
            {conversation.starred && (
              <i className="ti ti-star-filled sidebar__item-badge-icon" />
            )}

            +
            {conversation.messageCount ||
              0}
          </span>
        </div>

        <div className="sidebar__item-title">
          {conversation.title ||
            "New Chat"}
        </div>

        <div className="sidebar__item-preview">
          {conversation.preview || ""}
        </div>
      </div>

      <div className="sidebar__item-actions">
        <button
          type="button"
          className={`sidebar__item-star ${
            conversation.starred
              ? "sidebar__item-star--on"
              : ""
          }`}
          title={
            conversation.starred
              ? "Unstar"
              : "Star"
          }
          disabled={
            savingStarId ===
            conversation.id
          }
          onClick={(event) => {
            event.stopPropagation();

            handleToggleStar(
              conversation,
            );
          }}
        >
          <i
            className={
              savingStarId ===
              conversation.id
                ? "ti ti-loader-2"
                : conversation.starred
                  ? "ti ti-star-filled"
                  : "ti ti-star"
            }
          />
        </button>

        <button
          type="button"
          className="sidebar__item-star sidebar__item-delete"
          title="Delete"
          onClick={(event) => {
            event.stopPropagation();

            openDeleteModal(
              conversation,
            );
          }}
        >
          <i className="ti ti-trash" />
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
              <i className="ti ti-history" />
            </div>

            <div>
              <p className="sidebar__title">
                History
              </p>

              <p className="sidebar__subtitle">
                of reflection
              </p>
            </div>
          </div>

          <SearchBox
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value,
              )
            }
            placeholder="Search"
          />
        </div>

        <div className="sidebar__list">
          {filtered.length === 0 ? (
            <div className="sidebar__empty">
              <i className="ti ti-message-off sidebar__empty-icon" />

              <p>
                No conversations yet
              </p>
            </div>
          ) : (
            <>
              {starred.length > 0 && (
                <>
                  <div className="sidebar__group-label">
                    <i className="ti ti-star-filled" />
                    Starred
                  </div>

                  {starred.map(
                    renderItem,
                  )}
                </>
              )}

              {recent.length > 0 && (
                <>
                  <div className="sidebar__group-label">
                    Last 30 days
                  </div>

                  {recent.map(
                    renderItem,
                  )}
                </>
              )}
            </>
          )}
        </div>

        <div className="sidebar__footer">
          <NewReflectionButton
            onClick={onNew}
          />

          <div
            className="sidebar__app-version"
            title={`AI Learning version ${appVersion}`}
          >
            AI Learning v{appVersion}
          </div>
        </div>
      </aside>

      {deleteTarget && (
        <div className="sidebar-delete-modal">
          <div
            className="sidebar-delete-modal__backdrop"
            onClick={
              closeDeleteModal
            }
          />

          <div className="sidebar-delete-modal__box">
            <div className="sidebar-delete-modal__icon">
              <i className="ti ti-trash" />
            </div>

            <h3 className="sidebar-delete-modal__title">
              Xóa đoạn chat này?
            </h3>

            <p className="sidebar-delete-modal__text">
              Đoạn chat{" "}
              <strong>
                {deleteTarget.title ||
                  "New Chat"}
              </strong>{" "}
              sẽ bị xóa khỏi lịch sử.
              Hành động này không thể
              hoàn tác.
            </p>

            <div className="sidebar-delete-modal__actions">
              <button
                type="button"
                className="sidebar-delete-modal__btn sidebar-delete-modal__btn--cancel"
                onClick={
                  closeDeleteModal
                }
              >
                Hủy
              </button>

              <button
                type="button"
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