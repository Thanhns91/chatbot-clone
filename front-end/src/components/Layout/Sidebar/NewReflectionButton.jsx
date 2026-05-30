import React from "react";

const NewReflectionButton = ({ onClick }) => {
  return (
    <button className="sidebar__new-btn" onClick={onClick}>
      <i className="ti ti-plus me-2"></i>
      New Chat
    </button>
  );
};

export default NewReflectionButton;