import React, { useState } from "react";

import "./ChatLayout.scss";

import Sidebar from "./Sidebar/Sidebar";
import Header from "./Header/Header";
import LibraryPanel from "./LibraryPanel/LibraryPanel";

const APP_VERSION =
  import.meta.env.VITE_APP_VERSION || "1.0.0";

const ChatLayout = ({
  children,
  conversations,
  setConversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  headerRight,
  currentUser,
  documents = [],
  selectedDocument,
  onSelectDocument,
  onDocumentsChanged,
}) => {
  const [libraryOpen, setLibraryOpen] =
    useState(false);

  const handleToggleStar = (id) => {
    setConversations?.(
      (previousConversations) =>
        previousConversations.map(
          (conversation) =>
            String(conversation.id) ===
            String(id)
              ? {
                  ...conversation,
                  starred:
                    !conversation.starred,
                }
              : conversation,
        ),
    );
  };

  const handleSelectDocument = async (
    document,
  ) => {
    await onSelectDocument?.(document);
    setLibraryOpen(false);
  };

  return (
    <div className="chat-layout app-chat-layout">
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        onSelect={onSelect}
        onNew={onNew}
        onToggleStar={
          handleToggleStar
        }
        onDelete={onDelete}
        appVersion={APP_VERSION}
      />

      <main className="chat-layout__main">
        <Header
          libraryOpen={libraryOpen}
          onToggleLibrary={() =>
            setLibraryOpen(
              (currentValue) =>
                !currentValue,
            )
          }
          headerRight={headerRight}
          currentUser={currentUser}
        />

        <div className="chat-layout__body">
          <div className="chat-layout__content">
            {children}
          </div>

          <LibraryPanel
            open={libraryOpen}
            onClose={() =>
              setLibraryOpen(false)
            }
            documents={documents}
            user={currentUser}
            selectedDocument={
              selectedDocument
            }
            onDocumentsChanged={
              onDocumentsChanged
            }
            onSelectDocument={
              handleSelectDocument
            }
          />
        </div>
      </main>
    </div>
  );
};

export default ChatLayout;