import { useState } from 'react';
import { ChevronRight, ChevronDown, Folder, List, Music, X, Plus, PanelLeftClose, PanelLeftOpen, AlertTriangle, Trash2, Sparkles } from 'lucide-react';
import { Playlist } from '../types/track';
import PlaylistContextMenu from './PlaylistContextMenu';
import SmartPlaylistModal from './SmartPlaylistModal';

interface PlaylistSidebarProps {
  playlists: Playlist[];
  onPlaylistSelect: (playlist: Playlist | null) => void;
  selectedPlaylist: Playlist | null;
  trackCount: number;
  onClose?: () => void;
  onAddTracksToPlaylist: (playlistName: string, trackIds: string[]) => void;
  onCreatePlaylist: (name: string, parent?: Playlist) => void;
  onCreateFolder: (name: string, parent?: Playlist) => void;
  onRenamePlaylist: (playlist: Playlist, newName: string) => void;
  onDeletePlaylist: (playlist: Playlist) => void;
  onDuplicatePlaylist: (playlist: Playlist) => void;
  onCreateSmartPlaylist: (name: string, conditions: any[], logicalOperator?: number) => Promise<void>;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  showMissingOnly: boolean;
  onToggleMissingOnly: () => void;
  missingCount: number;
  onDeleteMissingTracks: () => void;
}

interface PlaylistTreeItemProps {
  playlist: Playlist;
  level: number;
  onSelect: (playlist: Playlist) => void;
  isSelected: boolean;
  selectedPlaylistName: string | null;
  onContextMenu: (playlist: Playlist, x: number, y: number) => void;
  onDrop: (playlist: Playlist, trackIds: string[]) => void;
}

function PlaylistTreeItem({ 
  playlist, 
  level, 
  onSelect, 
  isSelected, 
  selectedPlaylistName,
  onContextMenu,
  onDrop 
}: PlaylistTreeItemProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isDragOver, setIsDragOver] = useState(false);
  const isFolder = playlist.Type === '0';
  const hasChildren = playlist.Children && playlist.Children.length > 0;
  const trackCount = playlist.Entries?.length || 0;

  const handleClick = () => {
    if (!isFolder) {
      onSelect(playlist);
    } else {
      setIsExpanded(!isExpanded);
    }
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu(playlist, e.clientX, e.clientY);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (isFolder) return; // Only playlists can receive tracks
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    if (isFolder) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    try {
      const data = e.dataTransfer.getData('application/json');
      const { trackIds } = JSON.parse(data);
      if (trackIds && trackIds.length > 0) {
        onDrop(playlist, trackIds);
      }
    } catch (error) {
      console.error('Error handling drop:', error);
    }
  };

  return (
    <div className="playlist-tree-item">
      <div
        className={`playlist-item ${isSelected ? 'selected' : ''} ${isFolder ? 'folder' : 'playlist'} ${isDragOver ? 'drag-over' : ''}`}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {hasChildren && (
          <button className="playlist-toggle" onClick={handleToggle}>
            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        )}
        {!hasChildren && <span className="playlist-spacer" />}
        
        {isFolder ? (
          <Folder size={16} className="playlist-icon" />
        ) : (
          <List size={16} className="playlist-icon playlist-icon-playlist" />
        )}
        
        <span className="playlist-name">{playlist.Name}</span>
        
        {!isFolder && trackCount > 0 && (
          <span className="playlist-count">{trackCount}</span>
        )}
      </div>

      {hasChildren && isExpanded && (
        <div className="playlist-children">
          {playlist.Children!.map((child, index) => (
            <PlaylistTreeItem
              key={`${child.Name}-${index}`}
              playlist={child}
              level={level + 1}
              onSelect={onSelect}
              isSelected={selectedPlaylistName === child.Name}
              selectedPlaylistName={selectedPlaylistName}
              onContextMenu={onContextMenu}
              onDrop={onDrop}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function PlaylistSidebar({ 
  playlists, 
  onPlaylistSelect, 
  selectedPlaylist,
  trackCount,
  onClose,
  onAddTracksToPlaylist,
  onCreatePlaylist,
  onCreateFolder,
  onRenamePlaylist,
  onDeletePlaylist,
  onDuplicatePlaylist,
  onCreateSmartPlaylist,
  isCollapsed = false,
  onToggleCollapse,
  showMissingOnly,
  onToggleMissingOnly,
  missingCount,
  onDeleteMissingTracks
}: PlaylistSidebarProps) {
  const [contextMenu, setContextMenu] = useState<{ playlist: Playlist; x: number; y: number } | null>(null);
  const [editingPlaylist, setEditingPlaylist] = useState<Playlist | null>(null);
  const [editName, setEditName] = useState('');
  const [showSmartPlaylistModal, setShowSmartPlaylistModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addType, setAddType] = useState<'playlist' | 'folder'>('playlist');
  const [newName, setNewName] = useState('');

  const handleAllTracksClick = () => {
    onPlaylistSelect(null);
    if (showMissingOnly) {
      onToggleMissingOnly();
    }
  };

  const handleContextMenu = (playlist: Playlist, x: number, y: number) => {
    setContextMenu({ playlist, x, y });
  };

  const handleCloseContextMenu = () => {
    setContextMenu(null);
  };

  const handleRename = (playlist: Playlist) => {
    setEditingPlaylist(playlist);
    setEditName(playlist.Name);
  };

  const handleConfirmRename = () => {
    if (editingPlaylist && editName.trim()) {
      onRenamePlaylist(editingPlaylist, editName.trim());
    }
    setEditingPlaylist(null);
    setEditName('');
  };

  const handleCancelRename = () => {
    setEditingPlaylist(null);
    setEditName('');
  };

  const handleDelete = (playlist: Playlist) => {
    if (confirm(`Delete "${playlist.Name}"?`)) {
      onDeletePlaylist(playlist);
    }
  };

  const handleCreatePlaylist = (parent?: Playlist) => {
    setAddType('playlist');
    setNewName('');
    setShowAddModal(true);
  };

  const handleCreateFolder = (parent?: Playlist) => {
    setAddType('folder');
    setNewName('');
    setShowAddModal(true);
  };

  const handleDrop = (playlist: Playlist, trackIds: string[]) => {
    onAddTracksToPlaylist(playlist.Name, trackIds);
  };

  const handleMissingTracksClick = () => {
    onToggleMissingOnly();
    if (selectedPlaylist) {
      onPlaylistSelect(null);
    }
  };

  return (
    <div className={`playlist-sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="playlist-sidebar-header">
        {!isCollapsed && (
          <>
            <div className="playlist-sidebar-title">
              <Music size={18} />
              <span>Library</span>
            </div>
            <div className="playlist-sidebar-actions">
              <button 
                className="playlist-sidebar-btn" 
                onClick={() => handleCreatePlaylist()}
                title="New Playlist"
              >
                <Plus size={16} />
              </button>
              <button
                className="playlist-sidebar-btn"
                onClick={() => setShowSmartPlaylistModal(true)}
                title="New Smart Playlist"
              >
                <Sparkles size={16} />
              </button>
              {onClose && (
                <button className="playlist-sidebar-close" onClick={onClose}>
                  <X size={18} />
                </button>
              )}
            </div>
          </>
        )}
        {onToggleCollapse && (
          <button 
            className="playlist-sidebar-toggle" 
            onClick={onToggleCollapse}
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {isCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        )}
      </div>

      {!isCollapsed && (
        <div className="playlist-sidebar-content">
          {/* All Tracks */}
          <div
            className={`playlist-item all-tracks ${!selectedPlaylist && !showMissingOnly ? 'selected' : ''}`}
            onClick={handleAllTracksClick}
          >
            <Music size={16} className="playlist-icon" />
            <span className="playlist-name">All Tracks</span>
            <span className="playlist-count">{trackCount}</span>
          </div>

          {/* Missing Tracks Filter */}
          {missingCount > 0 && (
            <>
              <div
                className={`playlist-item missing-tracks-filter ${showMissingOnly ? 'selected' : ''}`}
                onClick={handleMissingTracksClick}
              >
                <AlertTriangle size={16} className="playlist-icon playlist-icon-missing" />
                <span className="playlist-name">Missing Tracks</span>
                <span className="playlist-count missing-count-badge">{missingCount}</span>
              </div>
              {showMissingOnly && (
                <div className="missing-tracks-actions">
                  <button
                    className="btn-delete-missing"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Delete ${missingCount} missing track${missingCount > 1 ? 's' : ''} from library?`)) {
                        onDeleteMissingTracks();
                      }
                    }}
                    title={`Delete ${missingCount} missing tracks`}
                  >
                    <Trash2 size={14} />
                    <span>Delete All Missing</span>
                  </button>
                </div>
              )}
            </>
          )}

        {/* Playlists Section */}
        {playlists.length > 0 && (
          <>
            <div className="playlist-section-divider" />
            <div className="playlist-section-header">
              <span>Playlists</span>
              <span className="playlist-section-count">{playlists.length}</span>
            </div>
            
            <div className="playlist-tree">
              {playlists.map((playlist, index) => (
                <PlaylistTreeItem
                  key={`${playlist.Name}-${index}`}
                  playlist={playlist}
                  level={0}
                  onSelect={onPlaylistSelect}
                  isSelected={selectedPlaylist?.Name === playlist.Name}
                  selectedPlaylistName={selectedPlaylist?.Name || null}
                  onContextMenu={handleContextMenu}
                  onDrop={handleDrop}
                />
              ))}
            </div>
          </>
        )}

        {playlists.length === 0 && (
          <div className="playlist-empty">
            <p>No playlists imported</p>
            <p className="playlist-empty-hint">Import from Rekordbox or scan a folder</p>
          </div>
        )}
        </div>
      )}

      {contextMenu && (
        <PlaylistContextMenu
          playlist={contextMenu.playlist}
          position={{ x: contextMenu.x, y: contextMenu.y }}
          onClose={handleCloseContextMenu}
          onRename={handleRename}
          onDelete={handleDelete}
          onCreatePlaylist={handleCreatePlaylist}
          onCreateFolder={handleCreateFolder}
          onDuplicate={onDuplicatePlaylist}
        />
      )}

      {editingPlaylist && (
        <div className="modal-overlay" onClick={handleCancelRename}>
          <div className="modal-content rename-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Rename {editingPlaylist.Type === '0' ? 'Folder' : 'Playlist'}</h3>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConfirmRename();
                if (e.key === 'Escape') handleCancelRename();
              }}
              autoFocus
              className="rename-input"
            />
            <div className="modal-actions">
              <button className="btn-secondary" onClick={handleCancelRename}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleConfirmRename}>
                Rename
              </button>
            </div>
          </div>
        </div>
      )}

      {showSmartPlaylistModal && (
        <SmartPlaylistModal
          isOpen={showSmartPlaylistModal}
          onClose={() => setShowSmartPlaylistModal(false)}
          onCreate={onCreateSmartPlaylist}
        />
      )}

      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content rename-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Create {addType === 'playlist' ? 'Playlist' : 'Folder'}</h3>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (addType === 'playlist') {
                    onCreatePlaylist(newName.trim());
                  } else {
                    onCreateFolder(newName.trim());
                  }
                  setShowAddModal(false);
                  setNewName('');
                }
                if (e.key === 'Escape') {
                  setShowAddModal(false);
                }
              }}
              placeholder={`New ${addType} name`}
              autoFocus
              className="rename-input"
            />
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowAddModal(false)}>
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={() => {
                  if (addType === 'playlist') {
                    onCreatePlaylist(newName.trim());
                  } else {
                    onCreateFolder(newName.trim());
                  }
                  setShowAddModal(false);
                  setNewName('');
                }}
                disabled={!newName.trim()}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

