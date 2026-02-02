import { useEffect, useRef } from 'react';
import { FolderOpen } from 'lucide-react';
import { Track } from '../types/track';

interface QuickTagContextMenuProps {
  x: number;
  y: number;
  track: Track;
  onClose: () => void;
  onShowInFinder: () => void;
}

export default function QuickTagContextMenu({
  x,
  y,
  onClose,
  onShowInFinder,
}: QuickTagContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  return (
    <div ref={menuRef} className="context-menu" style={{ left: x, top: y }}>
      <div className="context-menu-header">
        <span className="context-menu-title">Track</span>
      </div>
      <div className="context-menu-separator" />
      <button
        type="button"
        className="context-menu-item"
        onClick={() => {
          onShowInFinder();
          onClose();
        }}
      >
        <FolderOpen size={16} />
        <span>Show in Finder</span>
      </button>
    </div>
  );
}
