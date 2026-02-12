import { Download, Settings, Database } from 'lucide-react';

interface HeaderProps {
  onImport?: () => void;
  onImportFolder?: () => void;
  onExport: () => void;
  onSettings: () => void;
  onDatabase?: () => void;
  loading: boolean;
  hasLibrary: boolean;
  onQuickTag: () => void;
  isQuickTagMode?: boolean;
}

export default function Header({
  onImport,
  onImportFolder,
  onExport,
  onSettings,
  onDatabase,
  loading,
  hasLibrary,
  onQuickTag,
  isQuickTagMode,
}: HeaderProps) {
  return (
    <header className="header">
      <div className="header-content">
        <div className="logo">
          <h1>Bonk!</h1>
          <span className="subtitle">Metadata Editor</span>
        </div>
        
        <div className="header-actions">
          <button 
            className={`btn btn-secondary ${isQuickTagMode ? 'active' : ''}`} 
            onClick={onQuickTag}
            title="Quick Tag mode"
          >
            Quick Tag
          </button>
          
          <div className="toolbar-separator" style={{ height: '24px' }} />

          {onDatabase && (
            <button 
              className="btn btn-secondary" 
              onClick={onDatabase}
              title="Rekordbox Database Manager"
            >
              <Database size={16} />
              <span>Rekordbox DB</span>
            </button>
          )}

          {onImport != null && (
            <button 
              className="btn btn-secondary" 
              onClick={onImport}
              disabled={loading}
            >
              Import XML
            </button>
          )}
          {onImportFolder != null && (
            <button 
              className="btn btn-secondary" 
              onClick={onImportFolder}
              disabled={loading}
            >
              Import Folder
            </button>
          )}

          <div className="toolbar-separator" style={{ height: '24px' }} />

          <button 
            className="btn btn-primary" 
            onClick={onExport}
            disabled={loading || !hasLibrary}
          >
            <Download size={16} />
            <span>Export XML</span>
          </button>

          <button 
            className="btn btn-icon" 
            onClick={onSettings}
            title="Settings"
            style={{ width: '32px', padding: 0 }}
          >
            <Settings size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}

