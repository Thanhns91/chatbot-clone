import React from "react";

const SearchBox = ({ value, onChange, placeholder = "Search" }) => {
  return (
    <div className="sidebar__search">
      <i className="ti ti-search sidebar__search-icon"></i>
      <input
        type="text"
        className="sidebar__search-input"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
      />
    </div>
  );
};

export default SearchBox;