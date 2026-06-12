import React from "react";
import Button from "react-bootstrap/Button";

const NewReflectionButton = ({ onClick }) => {
  return (
    <Button className="sidebar__new-btn" onClick={onClick}>
      <i className="ti ti-plus me-2"></i>
      New Chat
    </Button>
  );
};

export default NewReflectionButton;