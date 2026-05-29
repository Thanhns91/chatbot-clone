import React from 'react';

const NewReflectionButton = ({ onClick }) => {
  return (
    <button className="sidebar__new-btn" onClick={onClick}>
      New Chat
    </button>
  );
};

export default NewReflectionButton;