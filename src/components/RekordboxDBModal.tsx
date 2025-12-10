import { useState, useEffect } from 'react';
import { Database, Download, Upload, RefreshCw, Settings, X, CheckCircle, AlertCircle, Loader } from 'lucide-react';

interface RekordboxDBModalProps {
  onClose: () => void;
  onImport: (library: any) => void;
  onSync: (updatedLibrary: any) => void;
  currentLibrary: any;
}

interface DBConfig {
  install_dir: string | null;
  app_dir: string | null;
  db_path: string | null;
}

type SyncMode = 'merge' | 'overwrite' | 'update';
type OperationStatus = 'idle' | 'loading' | 'success' | 'error';

export default function RekordboxDBModal({ onClose, onImport, onSync, currentLibrary }: RekordboxDBModalProps) {
  const [config, setConfig] = useState<DBConfig | null>(null);
  const [customDbPath, setCustomDbPath] = useState<string>('');
  const [syncMode, setSyncMode] = useState<SyncMode>('merge');
  const [status, setStatus] = useState<OperationStatus>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [detailsMessage, setDetailsMessage] = useState<string>('');
  const [showConfig, setShowConfig] = useState(false);
  const [customInstallDir, setCustomInstallDir] = useState('');
  const [customAppDir, setCustomAppDir] = useState('');

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      if (!window.electronAPI) return;
      
      const result = await (window.electronAPI as any).rekordboxGetConfig?.();
      if (result?.success) {
        setConfig(result.config);
        if (result.config.db_path) {
          setCustomDbPath(result.config.db_path);
        }
      }
    } catch (error) {
      console.error('Failed to load config:', error);
    }
  };

  const handleUpdateConfig = async () => {
    try {
      if (!window.electronAPI || !customInstallDir || !customAppDir) return;

      setStatus('loading');
      setStatusMessage('Updating configuration...');

      const result = await (window.electronAPI as any).rekordboxSetConfig?.(
        customInstallDir,
        customAppDir
      );

      if (result?.success) {
        setStatus('success');
        setStatusMessage('Configuration updated successfully');
        await loadConfig();
        setTimeout(() => {
          setStatus('idle');
          setShowConfig(false);
        }, 2000);
      } else {
        setStatus('error');
        setStatusMessage('Failed to update configuration');
        setDetailsMessage(result?.error || 'Unknown error');
      }
    } catch (error: any) {
      setStatus('error');
      setStatusMessage('Error updating configuration');
      setDetailsMessage(error.message);
    }
  };

  const handleSelectDatabase = async () => {
    try {
      if (!window.electronAPI) return;

      const dbPath = await (window.electronAPI as any).rekordboxSelectDatabase?.();
      if (dbPath) {
        setCustomDbPath(dbPath);
      }
    } catch (error) {
      console.error('Failed to select database:', error);
    }
  };

  const handleImportFromDB = async () => {
    try {
      if (!window.electronAPI) return;

      setStatus('loading');
      setStatusMessage('Importing from Rekordbox database...');
      setDetailsMessage('This may take a few moments for large libraries');

      const result = await (window.electronAPI as any).rekordboxImportDatabase?.(
        customDbPath || null
      );

      if (result?.success && result.library) {
        setStatus('success');
        setStatusMessage(`Successfully imported ${result.trackCount} tracks and ${result.playlistCount} playlists`);
        
        const dbPath = result.db_path || customDbPath || config?.db_path || 'Auto-detected';
        let detailsMsg = `Database: ${dbPath}`;
        if (result.db_path && result.db_path.endsWith('master.db')) {
          detailsMsg += '\n✓ Confirmed: master.db file';
        }
        setDetailsMessage(detailsMsg);
        
        onImport(result.library);
        
        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        setStatus('error');
        setStatusMessage('Import failed');
        setDetailsMessage(result?.error || 'Unknown error occurred');
      }
    } catch (error: any) {
      setStatus('error');
      setStatusMessage('Import error');
      setDetailsMessage(error.message);
    }
  };

  const handleExportToDB = async () => {
    try {
      if (!window.electronAPI || !currentLibrary) return;

      setStatus('loading');
      setStatusMessage('Exporting to Rekordbox database...');
      setDetailsMessage(`Mode: ${syncMode}`);

      const result = await (window.electronAPI as any).rekordboxExportDatabase?.(
        currentLibrary,
        customDbPath || null,
        syncMode
      );

      if (result?.success) {
        setStatus('success');
        const added = result.added || 0;
        const updated = result.updated || 0;
        const deleted = result.deleted || 0;
        const skipped = result.skipped || 0;
        const parts = [];
        if (added > 0) parts.push(`${added} added`);
        if (updated > 0) parts.push(`${updated} updated`);
        if (deleted > 0) parts.push(`${deleted} deleted`);
        if (skipped > 0) parts.push(`${skipped} skipped`);
        setStatusMessage(`Export complete: ${parts.join(', ')}`);
        
        const dbPath = result.db_path || customDbPath || config?.db_path || 'Auto-detected';
        let detailsMsg = `Database: ${dbPath}`;
        if (result.db_path && result.db_path.endsWith('master.db')) {
          detailsMsg += '\n✓ Confirmed: master.db file';
        }
        if (result.errors && result.errors.length > 0) {
          detailsMsg += `\n\nErrors: ${result.errors.slice(0, 3).join(', ')}${result.errors.length > 3 ? '...' : ''}`;
        }
        setDetailsMessage(detailsMsg);

        setTimeout(() => {
          setStatus('idle');
        }, 3000);
      } else {
        setStatus('error');
        setStatusMessage('Export failed');
        setDetailsMessage(result?.error || 'Unknown error occurred');
      }
    } catch (error: any) {
      setStatus('error');
      setStatusMessage('Export error');
      setDetailsMessage(error.message);
    }
  };

  const handleSyncWithDB = async () => {
    try {
      if (!window.electronAPI || !currentLibrary) return;

      setStatus('loading');
      setStatusMessage('Syncing with Rekordbox database...');
      setDetailsMessage('Analyzing changes...');

      const result = await (window.electronAPI as any).rekordboxSyncDatabase?.(
        currentLibrary,
        customDbPath || null
      );

      if (result?.success) {
        setStatus('success');
        setStatusMessage(
          `Sync complete: ${result.updated_in_db || 0} updates to Rekordbox, ${result.updated_in_bonk || 0} updates to Bonk`
        );
        
        if (result.conflicts && result.conflicts.length > 0) {
          setDetailsMessage(`${result.conflicts.length} conflicts resolved`);
        } else {
          setDetailsMessage('No conflicts found');
        }

        // Update library with synced data
        if (result.tracks) {
          onSync({ ...currentLibrary, tracks: result.tracks });
        }

        setTimeout(() => {
          setStatus('idle');
        }, 3000);
      } else {
        setStatus('error');
        setStatusMessage('Sync failed');
        setDetailsMessage(result?.error || 'Unknown error occurred');
      }
    } catch (error: any) {
      setStatus('error');
      setStatusMessage('Sync error');
      setDetailsMessage(error.message);
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'loading':
        return <Loader className="animate-spin" size={20} />;
      case 'success':
        return <CheckCircle size={20} className="text-green-500" />;
      case 'error':
        return <AlertCircle size={20} className="text-red-500" />;
      default:
        return null;
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content rekordbox-db-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <Database size={24} />
            <span>Rekordbox Database Manager</span>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {/* Configuration Section - Only show if auto-detection failed */}
          {!config?.db_path && (
            <div className="db-section">
              <div className="db-section-header">
                <Settings size={18} />
                <h3>Configuration</h3>
                <button 
                  className="btn-link"
                  onClick={() => setShowConfig(!showConfig)}
                >
                  {showConfig ? 'Hide' : 'Show'}
                </button>
              </div>

              {showConfig && (
                <div className="config-form">
                  <div className="form-group">
                    <label>Pioneer Install Directory</label>
                    <input
                      type="text"
                      value={customInstallDir || config?.install_dir || ''}
                      onChange={(e) => setCustomInstallDir(e.target.value)}
                      placeholder="/Applications/Pioneer/rekordbox 6"
                    />
                  </div>
                  <div className="form-group">
                    <label>Pioneer App Directory</label>
                    <input
                      type="text"
                      value={customAppDir || config?.app_dir || ''}
                      onChange={(e) => setCustomAppDir(e.target.value)}
                      placeholder="~/Library/Pioneer"
                    />
                  </div>
                  <button 
                    className="btn-primary"
                    onClick={handleUpdateConfig}
                    disabled={!customInstallDir || !customAppDir}
                  >
                    Update Configuration
                  </button>
                </div>
              )}

              <div className="config-info">
                <div className="info-item warning">
                  <AlertCircle size={16} />
                  <span>No Rekordbox installation detected. Use custom path below or configure paths above.</span>
                </div>
              </div>
            </div>
          )}

          {/* Database Path Section - Only show if auto-detection failed or user wants custom path */}
          {(!config?.db_path || customDbPath) && (
            <div className="db-section">
              <div className="db-section-header">
                <Database size={18} />
                <h3>Database Location</h3>
                {config?.db_path && (
                  <button 
                    className="btn-link"
                    onClick={() => setCustomDbPath('')}
                  >
                    Use Auto-Detected
                  </button>
                )}
              </div>
              <p className="section-description">
                {config?.db_path 
                  ? "Override auto-detected database path (optional)"
                  : "Path to master.db (leave empty for auto-detect)"}
              </p>
              <div className="db-path-selector">
                <input
                  type="text"
                  value={customDbPath}
                  onChange={(e) => setCustomDbPath(e.target.value)}
                  placeholder={config?.db_path || "Path to master.db (leave empty for auto-detect)"}
                  className="db-path-input"
                />
                <button className="btn-secondary" onClick={handleSelectDatabase}>
                  Browse...
                </button>
              </div>
            </div>
          )}

          {/* Import Section */}
          <div className="db-section">
            <div className="db-section-header">
              <Download size={18} />
              <h3>Import from Rekordbox</h3>
            </div>
            <p className="section-description">
              Load your complete Rekordbox library into Bonk for editing. This includes tracks, playlists, and metadata.
            </p>
            <button 
              className="btn-primary btn-large"
              onClick={handleImportFromDB}
              disabled={status === 'loading'}
            >
              <Download size={20} />
              Import from Database
            </button>
          </div>

          {/* Export Section */}
          {currentLibrary && (
            <>
              <div className="db-section">
                <div className="db-section-header">
                  <Upload size={18} />
                  <h3>Export to Rekordbox</h3>
                </div>
                <p className="section-description">
                  Write your Bonk library changes back to Rekordbox database.
                </p>
                
                <div className="sync-mode-selector">
                  <label>Sync Mode:</label>
                  <div className="radio-group">
                    <label className="radio-option">
                      <input
                        type="radio"
                        value="merge"
                        checked={syncMode === 'merge'}
                        onChange={(e) => setSyncMode(e.target.value as SyncMode)}
                      />
                      <div>
                        <strong>Merge</strong>
                        <span>Add new tracks, update existing</span>
                      </div>
                    </label>
                    <label className="radio-option">
                      <input
                        type="radio"
                        value="update"
                        checked={syncMode === 'update'}
                        onChange={(e) => setSyncMode(e.target.value as SyncMode)}
                      />
                      <div>
                        <strong>Update Only</strong>
                        <span>Update existing tracks, skip new ones</span>
                      </div>
                    </label>
                    <label className="radio-option">
                      <input
                        type="radio"
                        value="overwrite"
                        checked={syncMode === 'overwrite'}
                        onChange={(e) => setSyncMode(e.target.value as SyncMode)}
                      />
                      <div>
                        <strong>Overwrite</strong>
                        <span>Replace all data (dangerous)</span>
                      </div>
                    </label>
                  </div>
                </div>

                <button 
                  className="btn-primary btn-large"
                  onClick={handleExportToDB}
                  disabled={status === 'loading'}
                >
                  <Upload size={20} />
                  Export to Database
                </button>
              </div>

              {/* Sync Section */}
              <div className="db-section">
                <div className="db-section-header">
                  <RefreshCw size={18} />
                  <h3>Two-Way Sync</h3>
                </div>
                <p className="section-description">
                  Intelligently sync changes between Bonk and Rekordbox. Bonk changes take precedence in conflicts.
                </p>
                <button 
                  className="btn-primary btn-large"
                  onClick={handleSyncWithDB}
                  disabled={status === 'loading'}
                >
                  <RefreshCw size={20} />
                  Sync with Database
                </button>
              </div>
            </>
          )}

          {/* Status Section */}
          {status !== 'idle' && (
            <div className={`status-section status-${status}`}>
              <div className="status-header">
                {getStatusIcon()}
                <span>{statusMessage}</span>
              </div>
              {detailsMessage && (
                <div className="status-details">{detailsMessage}</div>
              )}
            </div>
          )}

          {/* Warning */}
          <div className="warning-section">
            <AlertCircle size={16} />
            <div>
              <strong>Important:</strong> Always backup your Rekordbox library before syncing! 
              (Rekordbox → File → Library → Backup Library)
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

