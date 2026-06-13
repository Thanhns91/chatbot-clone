import React, { useState } from 'react'
import './ChatLayout.scss'
import Sidebar from './Sidebar/Sidebar'
import Header from './Header/Header'
import LibraryPanel from './LibraryPanel/LibraryPanel'

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
}) => {
  const [libraryOpen, setLibraryOpen] = useState(false)

  const handleToggleStar = (id) => {
    setConversations?.((prev) =>
      prev.map((c) =>
        String(c.id) === String(id) ? { ...c, starred: !c.starred } : c
      )
    )
  }

  return (
    <div className="chat-layout">
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        onSelect={onSelect}
        onNew={onNew}
        onToggleStar={handleToggleStar}
        onDelete={onDelete}
      />

      <main className="chat-layout__main">
        <Header
          libraryOpen={libraryOpen}
          onToggleLibrary={() => setLibraryOpen((v) => !v)}
          headerRight={headerRight}
          currentUser={currentUser}
        />

        <div className="chat-layout__body">
          <div className="chat-layout__content">{children}</div>

          <LibraryPanel
            open={libraryOpen}
            onClose={() => setLibraryOpen(false)}
            documents={documents}
            selectedDocument={selectedDocument}
            onSelectDocument={async (doc) => {
              await onSelectDocument?.(doc)
              setLibraryOpen(false)
            }}
          />
        </div>
      </main>
    </div>
  )
}

export default ChatLayout