import { Edit2, Trash2, FolderPlus, PlusSquare, Copy } from 'lucide-react';
import { Playlist } from '../types/track';

interface PlaylistContextMenuProps {
  playlist: Playlist;
  position: { x: number; y: number };
  onClose: () => void;
  onRename: (playlist: Playlist) => void;
  onDelete: (playlist: Playlist) => void;
  onCreatePlaylist: (parentPlaylist: Playlist) => void;
  onCreateFolder: (parentPlaylist: Playlist) => void;
  onDuplicate: (playlist: Playlist) => void;
}

export default function PlaylistContextMenu({
  playlist,
  position,
  onClose,
  onRename,
  onDelete,
  onCreatePlaylist,
  onCreateFolder,
  onDuplicate,
}: PlaylistContextMenuProps) {
  const isFolder = playlist.Type === '0';

  const handleAction = (action: () => void) => {
    action();
    onClose();
  };

  return (
    <>
      <div className="context-menu-overlay" onClick={onClose} />
      <div
        className="context-menu playlist-context-menu"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
        }}
      >
        <button
          className="context-menu-item"
          onClick={() => handleAction(() => onRename(playlist))}
        >
          <Edit2 size={14} />
          Rename
        </button>

        {isFolder && (
          <>
            <div className="context-menu-separator" />
            <button
              className="context-menu-item"
              onClick={() => handleAction(() => onCreatePlaylist(playlist))}
            >
              <PlusSquare size={14} />
              New Playlist
            </button>
            <button
              className="context-menu-item"
              onClick={() => handleAction(() => onCreateFolder(playlist))}
            >
              <FolderPlus size={14} />
              New Folder
            </button>
          </>
        )}

        <div className="context-menu-separator" />
        
        <button
          className="context-menu-item"
          onClick={() => handleAction(() => onDuplicate(playlist))}
        >
          <Copy size={14} />
          Duplicate
        </button>

        <div className="context-menu-separator" />
        
        <button
          className="context-menu-item danger"
          onClick={() => handleAction(() => onDelete(playlist))}
        >
          <Trash2 size={14} />
          Delete
        </button>
      </div>
    </>
  );
}

