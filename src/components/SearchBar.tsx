import { useState, useEffect, useCallback } from 'react';
import { Search } from 'lucide-react';
import { useLibraryStore } from '../store/useLibraryStore';

export default function SearchBar() {
  const { searchQuery, setSearchQuery, filteredTracks, library } = useLibraryStore();
  const [localQuery, setLocalQuery] = useState(searchQuery);

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

  return (
    <div className="search-bar">
      <div className="search-input-wrapper">
        <Search size={20} className="search-icon" />
        <input
          type="text"
          placeholder="Search tracks by name, artist, album, genre, or key..."
          value={localQuery}
          onChange={handleChange}
          className="search-input"
        />
      </div>
      <div className="search-stats">
        Showing {filteredTracks.length} of {library?.tracks.length || 0} tracks
      </div>
    </div>
  );
}

