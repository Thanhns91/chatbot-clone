import React from 'react';

const SearchBox = ({ value, onChange, placeholder = 'Search' }) => {
  return (
    <div className="sidebar__search">
      <svg
        className="sidebar__search-icon"
        viewBox="0 0 20 20"
        fill="none"
        stroke="#7a9db5"
        strokeWidth="2"
        strokeLinecap="round"
        xmlns="http://www.w3.org/2000/svg"
        style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', pointerEvents: 'none', zIndex: 2 }}
      >
        <circle cx="8.5" cy="8.5" r="5.5" />
        <line x1="12.5" y1="12.5" x2="17" y2="17" />
      </svg>
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