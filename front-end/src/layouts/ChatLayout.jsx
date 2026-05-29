import React from 'react';
import './ChatLayout.css';
import Sidebar from '../components/Sidebar/Sidebar';

const ChatLayout = ({ children, conversations, activeId, onSelect, onNew }) => {
  return (
    <div className="chat-layout">
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        onSelect={onSelect}
        onNew={onNew}
      />
      <main className="chat-layout__main">
        {children}
      </main>
    </div>
  );
};

export default ChatLayout;