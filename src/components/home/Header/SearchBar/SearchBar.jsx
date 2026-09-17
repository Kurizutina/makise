import React, { useState } from 'react';
import './SearchBar.css';

const SearchBar = ({ onSearch }) => {
  const [searchText, setSearchText] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();

    onSearch?.(searchText);
  };

  return (
    <form className="home-search" onSubmit={handleSubmit}>
    <i className="fas fa-search search-icon"></i>


      <input
        type="text"
        placeholder="Search brands..."
        value={searchText}
        onChange={(e) => { setSearchText(e.target.value); onSearch?.(e.target.value); }}
      />

      {searchText && (
        <button
          type="button"
          className="clear-search"
          onClick={() => { setSearchText(''); onSearch?.(''); }}
        >
          <i className="fa-solid fa-xmark"></i>
        </button>
      )}

    </form>
  );
};

export default SearchBar;
