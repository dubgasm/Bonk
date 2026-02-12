import { useState, useRef, useEffect } from 'react';
import { Columns } from 'lucide-react';
import { useColumnStore } from '../store/useColumnStore';
import './ColumnSelector.css';

export default function ColumnSelector() {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { columns, setColumnVisibility, resetColumns } = useColumnStore();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Calculate visible columns excluding checkbox
  const visibleCount = columns.filter(c => c.visible && c.id !== 'checkbox').length;

  return (
    <div className="column-selector-wrapper" ref={wrapperRef}>
      <button 
        className={`btn btn-sm btn-secondary ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title="Manage Columns"
        style={{ height: '24px' }} // Match toolbar height
      >
        <Columns size={14} />
      </button>

      {isOpen && (
        <div className="column-selector-dropdown">
          <div className="column-selector-header">
            <span>Visible Columns</span>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{visibleCount} active</span>
          </div>
          
          <div className="column-list">
            {columns.map(col => (
              col.id !== 'checkbox' && (
                <label key={col.id} className="column-option">
                  <input
                    type="checkbox"
                    checked={col.visible}
                    onChange={(e) => setColumnVisibility(col.id, e.target.checked)}
                  />
                  <span className="column-label">{col.label}</span>
                </label>
              )
            ))}
          </div>

          <div className="column-selector-footer">
            <button className="reset-btn" onClick={resetColumns}>
              Reset to Default
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
