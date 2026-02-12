import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { useLibraryStore } from '../store/useLibraryStore';

export default function SearchBar() {
  const { searchQuery, setSearchQuery, filteredTracks, library } = useLibraryStore();
  const [localQuery, setLocalQuery] = useState(searchQuery);
  const inputRef = useRef<HTMLInputElement>(null);

  // Global keyboard shortcuts for search
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Press '/' to focus search (unless typing in another input)
      if (e.key === '/' && 
          !(e.target instanceof HTMLInputElement) && 
          !(e.target instanceof HTMLTextAreaElement) &&
          !(e.target as HTMLElement).isContentEditable
      ) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Debounce search input - update store after 300ms of no typing
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localQuery !== searchQuery) {
        setSearchQuery(localQuery);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [localQuery, searchQuery, setSearchQuery]);

  // Sync local query when store query changes externally
  useEffect(() => {
    setLocalQuery(searchQuery);
  }, [searchQuery]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalQuery(e.target.value);
  }, []);

  const handleClear = useCallback(() => {
    setLocalQuery('');
    setSearchQuery('');
    inputRef.current?.focus();
  }, [setSearchQuery]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      if (localQuery) {
        handleClear();
      } else {
        inputRef.current?.blur();
      }
    }
  }, [localQuery, handleClear]);

  return (
    <div className="search-bar">
      <div className="search-input-wrapper">
        <Search size={20} className="search-icon" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search tracks... (/)"
          value={localQuery}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          className="search-input"
        />
        {localQuery && (
          <button 
            className="search-clear-btn" 
            onClick={handleClear}
            aria-label="Clear search"
          >
            <X size={16} />
          </button>
        )}
      </div>
      <div className="search-stats">
        Showing {filteredTracks.length} of {library?.tracks.length || 0} tracks
      </div>
    </div>
  );
}

