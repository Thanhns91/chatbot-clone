import React from 'react';
import './Sidebar.css';
import SearchBox from './SearchBox';
import NewReflectionButton from './NewReflectionButton';

const Sidebar = ({ conversations = [], activeId, onSelect, onNew }) => {
  return (
    <aside className="sidebar">
      <div className="sidebar__header">
        <h2 className="sidebar__title">History of reflection</h2>
        <SearchBox />
      </div>

      <div className="sidebar__list">
        {conversations.length === 0 ? (
          <p className="sidebar__empty">No conversations yet</p>
        ) : (
          conversations.map((conv) => (
            <div
              key={conv.id}
              className={`sidebar__item ${conv.id === activeId ? 'sidebar__item--active' : ''}`}
              onClick={() => onSelect?.(conv.id)}
            >
              {conv.title}
            </div>
          ))
        )}
      </div>

      <div className="sidebar__footer">
        <NewReflectionButton onClick={onNew} />
      </div>
    </aside>
  );
};

export default Sidebar;