import { useEffect, useCallback, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  Square,
  Check,
  AlertCircle,
  GripVertical,
  Music,
  Database,
  Settings,
  ListChecks,
  RefreshCw,
  FolderOpen,
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { toast } from 'sonner';
import { useAutoTagStore } from '../store/useAutoTagStore';
import { useSettingsStore } from '../store/useSettingsStore';
import {
  ProviderConfig,
  ALL_TAGS,
  WIZARD_STEPS,
  AutoTagEvent,
} from '../types/autotag';
import './AutoTagWizard.css';

// ============================================================================
// Sortable Provider Item
// ============================================================================

interface SortableProviderProps {
  provider: ProviderConfig;
  onToggle: () => void;
  onCheckAuth: () => void;
}

function SortableProvider({ provider, onToggle, onCheckAuth }: SortableProviderProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: provider.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const getAuthBadge = () => {
    if (!provider.requiresAuth) {
      return <span className="provider-badge provider-badge-free">Free</span>;
    }
    switch (provider.authState) {
      case 'authenticated':
        return <span className="provider-badge provider-badge-auth">Authenticated</span>;
      case 'error':
        return <span className="provider-badge provider-badge-error">Auth Error</span>;
      default:
        return (
          <button className="provider-auth-btn" onClick={onCheckAuth}>
            Set Credentials
          </button>
        );
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`provider-item ${provider.enabled ? 'provider-enabled' : ''}`}
    >
      <div className="provider-drag" {...attributes} {...listeners}>
        <GripVertical size={16} />
      </div>
      <label className="provider-checkbox">
        <input
          type="checkbox"
          checked={provider.enabled}
          onChange={onToggle}
          disabled={provider.requiresAuth && provider.authState !== 'authenticated'}
        />
        <span className="checkmark" />
      </label>
      <div className="provider-info">
        <span className="provider-name">{provider.name}</span>
        <span className="provider-desc">{provider.description}</span>
      </div>
      {getAuthBadge()}
    </div>
  );
}

// ============================================================================
// Main Wizard Component
// ============================================================================

export default function AutoTagWizard() {
  const {
    isOpen,
    closeModal,
    step,
    nextStep,
    prevStep,
    goToStep,
    selectedFiles,
    providers,
    toggleProvider,
    reorderProviders,
    setProviderAuth,
    getEnabledProviders,
    selectedTags,
    toggleTag,
    enableAllTags,
    disableAllTags,
    toggleAllTags,
    advanced,
    setAdvancedOption,
    run,
    startRun,
    pauseRun,
    resumeRun,
    cancelRun,
    ingestEvent,
    setResults,
  } = useAutoTagStore();

  const { apiCredentials, taggingPreferences } = useSettingsStore();

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; filePath: string } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle provider reorder
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = providers.findIndex((p) => p.id === active.id);
      const newIndex = providers.findIndex((p) => p.id === over.id);
      reorderProviders(oldIndex, newIndex);
    }
  };

  // Check provider auth on mount and when credentials change
  useEffect(() => {
    const checkAuth = async () => {
      const api = (window as any).electronAPI;
      if (!api?.autotagCheckAuth) return;

      for (const provider of providers) {
        if (provider.requiresAuth) {
          try {
            const result = await api.autotagCheckAuth(provider.id, apiCredentials);
            if (result.authenticated) {
              setProviderAuth(provider.id, 'authenticated');
            } else {
              setProviderAuth(provider.id, 'required');
            }
          } catch (e) {
            console.error('Auth check failed:', e);
          }
        }
      }
    };
    if (isOpen) {
      checkAuth();
    }
  }, [isOpen, apiCredentials]);

  // Set up IPC listeners
  useEffect(() => {
    const api = (window as any).electronAPI;
    if (!api) return;

    const handleEvent = (event: AutoTagEvent) => {
      ingestEvent(event);
      
      // Show toast for certain events
      if (event.type === 'completed') {
        toast.success(`Auto-tagging complete!`);
      } else if (event.type === 'error') {
        toast.error(event.error || 'Auto-tagging failed');
      }
    };

    const handleResult = (data: { runId: string; results: any[] }) => {
      setResults(data.results);
    };

    api.onAutotagEvent?.(handleEvent);
    api.onAutotagResult?.(handleResult);

    return () => {
      api.removeAutotagListeners?.();
    };
  }, [ingestEvent, setResults]);

  // Start the run
  const handleStart = useCallback(async () => {
    const api = (window as any).electronAPI;
    if (!api?.autotagStart) {
      toast.error('AutoTag not available');
      return;
    }

    const enabledProviders = getEnabledProviders();
    if (enabledProviders.length === 0) {
      toast.error('Please enable at least one provider');
      return;
    }

    if (selectedFiles.length === 0) {
      toast.error('No tracks selected');
      return;
    }

    startRun();
    const { run: currentRun } = useAutoTagStore.getState();

    try {
      await api.autotagStart({
        runId: currentRun.runId,
        files: selectedFiles,
        providers: enabledProviders,
        tags: selectedTags,
        advanced,
        credentials: apiCredentials,
        preferences: taggingPreferences,
      });
    } catch (e) {
      toast.error('Failed to start auto-tagging');
    }
  }, [selectedFiles, selectedTags, advanced, getEnabledProviders, startRun, apiCredentials, taggingPreferences]);

  // Pause/Resume
  const handlePauseResume = useCallback(async () => {
    const api = (window as any).electronAPI;
    if (!api) return;

    if (run.status === 'running') {
      await api.autotagPause?.(run.runId);
      pauseRun();
    } else if (run.status === 'paused') {
      await api.autotagResume?.(run.runId);
      resumeRun();
    }
  }, [run.status, run.runId, pauseRun, resumeRun]);

  // Cancel
  const handleCancel = useCallback(async () => {
    const api = (window as any).electronAPI;
    if (api?.autotagCancel && run.runId) {
      await api.autotagCancel(run.runId);
    }
    cancelRun();
  }, [run.runId, cancelRun]);

  if (!isOpen) return null;

  // Validation for each step
  const canProceed = () => {
    switch (step) {
      case 0:
        return getEnabledProviders().length > 0;
      case 1:
        return selectedTags.length > 0;
      case 2:
        return true;
      case 3:
        return run.status === 'done' || run.status === 'error';
      default:
        return true;
    }
  };

  const progressPercent = run.progress.total > 0
    ? Math.round((run.progress.current / run.progress.total) * 100)
    : 0;

  return (
    <motion.div
      className="autotag-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="autotag-wizard"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
      >
        {/* Header */}
        <div className="autotag-header">
          <h2>Auto Tag</h2>
          <span className="autotag-track-count">{selectedFiles.length} tracks</span>
          <button
            className="autotag-close"
            onClick={closeModal}
            disabled={run.status === 'running'}
          >
            <X size={20} />
          </button>
        </div>

        {/* Stepper */}
        <div className="autotag-stepper">
          {WIZARD_STEPS.map((s, i) => (
            <button
              key={s.step}
              className={`stepper-step ${step === s.step ? 'active' : ''} ${step > s.step ? 'completed' : ''}`}
              onClick={() => goToStep(s.step)}
              disabled={run.status === 'running' || (s.step === 4 && run.results.length === 0)}
            >
              <span className="stepper-num">{i + 1}</span>
              <span className="stepper-label">{s.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="autotag-content">
          <AnimatePresence mode="wait">
            {/* Step 0: Providers */}
            {step === 0 && (
              <motion.div
                key="providers"
                className="autotag-step"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <h3>
                  <Database size={20} />
                  Select Data Sources
                </h3>
                <p className="step-desc">
                  Choose and prioritize the providers to search. Drag to reorder priority.
                </p>

                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={providers.map((p) => p.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="provider-list">
                      {providers.map((provider) => (
                        <SortableProvider
                          key={provider.id}
                          provider={provider}
                          onToggle={() => toggleProvider(provider.id)}
                          onCheckAuth={() => {
                            toast.info(`Set ${provider.name} credentials in Settings`);
                          }}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </motion.div>
            )}

            {/* Step 1: Tags */}
            {step === 1 && (
              <motion.div
                key="tags"
                className="autotag-step"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <h3>
                  <ListChecks size={20} />
                  Select Tags to Update
                </h3>
                <p className="step-desc">
                  Choose which metadata fields to fetch and update.
                </p>

                <div className="tag-actions">
                  <button className="tag-action-btn" onClick={enableAllTags}>
                    Enable All
                  </button>
                  <button className="tag-action-btn" onClick={disableAllTags}>
                    Disable All
                  </button>
                  <button className="tag-action-btn" onClick={toggleAllTags}>
                    Toggle
                  </button>
                </div>

                <div className="tag-groups">
                  {(['identity', 'classification', 'ids', 'musical', 'numbering', 'dates', 'lyrics', 'other'] as const).map((group) => {
                    const groupTags = ALL_TAGS.filter((t) => t.group === group);
                    if (groupTags.length === 0) return null;
                    return (
                      <div key={group} className="tag-group">
                        <h4>{group.charAt(0).toUpperCase() + group.slice(1)}</h4>
                        <div className="tag-checkboxes">
                          {groupTags.map((tag) => (
                            <label key={tag.key} className="tag-checkbox">
                              <input
                                type="checkbox"
                                checked={selectedTags.includes(tag.key)}
                                onChange={() => toggleTag(tag.key)}
                              />
                              <span>{tag.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* Step 2: Advanced Options */}
            {step === 2 && (
              <motion.div
                key="options"
                className="autotag-step"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <h3>
                  <Settings size={20} />
                  Advanced Options
                </h3>
                <p className="step-desc">
                  Configure matching behavior and file operations.
                </p>

                <div className="options-sections">
                  <div className="options-section">
                    <h4>Skip Rules</h4>
                    <label className="option-checkbox">
                      <input
                        type="checkbox"
                        checked={advanced.skipAlreadyTagged}
                        onChange={(e) => setAdvancedOption('skipAlreadyTagged', e.target.checked)}
                      />
                      <span>Skip tracks that already have artist & title</span>
                    </label>
                  </div>

                  <div className="options-section">
                    <h4>Overwrite Mode</h4>
                    <div className="option-radios">
                      {(['never', 'ifEmpty', 'always'] as const).map((mode) => (
                        <label key={mode} className="option-radio">
                          <input
                            type="radio"
                            name="overwriteMode"
                            checked={advanced.overwriteMode === mode}
                            onChange={() => setAdvancedOption('overwriteMode', mode)}
                          />
                          <span>
                            {mode === 'never' && 'Never overwrite'}
                            {mode === 'ifEmpty' && 'Only if empty'}
                            {mode === 'always' && 'Always overwrite'}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="options-section">
                    <h4>Match Confidence</h4>
                    <div className="confidence-slider">
                      <input
                        type="range"
                        min="50"
                        max="100"
                        value={advanced.minimumConfidence}
                        onChange={(e) => setAdvancedOption('minimumConfidence', parseInt(e.target.value))}
                      />
                      <span className="confidence-value">{advanced.minimumConfidence}%</span>
                    </div>
                    <p className="option-hint">
                      Higher values require better matches. 70% is recommended.
                    </p>
                  </div>

                  <div className="options-section">
                    <h4>File Operations</h4>
                    <label className="option-checkbox">
                      <input
                        type="checkbox"
                        checked={advanced.writeTagsToFile}
                        onChange={(e) => setAdvancedOption('writeTagsToFile', e.target.checked)}
                      />
                      <span>Write tags to audio files</span>
                    </label>
                    <label className="option-checkbox">
                      <input
                        type="checkbox"
                        checked={advanced.saveAlbumArtToFile}
                        onChange={(e) => setAdvancedOption('saveAlbumArtToFile', e.target.checked)}
                      />
                      <span>Save album art to folder</span>
                    </label>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 3: Run */}
            {step === 3 && (
              <motion.div
                key="run"
                className="autotag-step"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <h3>
                  <Play size={20} />
                  Processing
                </h3>

                {run.status === 'idle' && (
                  <div className="run-idle">
                    <p>Ready to process {selectedFiles.length} tracks.</p>
                    <button className="run-start-btn" onClick={handleStart}>
                      <Play size={20} />
                      Start Auto-Tagging
                    </button>
                  </div>
                )}

                {(run.status === 'running' || run.status === 'paused') && (
                  <div className="run-progress">
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                    <div className="progress-stats">
                      <span>
                        {run.progress.current} / {run.progress.total}
                      </span>
                      <span>{progressPercent}%</span>
                    </div>

                    {run.currentTrack && (
                      <div className="current-track">
                        <Music size={16} />
                        <span>
                          {run.currentTrack.artist
                            ? `${run.currentTrack.artist} - ${run.currentTrack.name}`
                            : run.currentTrack.name}
                        </span>
                        {run.currentProvider && (
                          <span className="current-provider">
                            via {run.currentProvider}
                          </span>
                        )}
                      </div>
                    )}

                    <div className="progress-counts">
                      <span className="count-success">
                        <Check size={14} /> {run.progress.success} success
                      </span>
                      <span className="count-failed">
                        <AlertCircle size={14} /> {run.progress.failed} failed
                      </span>
                      <span className="count-skipped">
                        <RefreshCw size={14} /> {run.progress.skipped} skipped
                      </span>
                    </div>

                    <div className="run-actions">
                      <button
                        className="run-action-btn"
                        onClick={handlePauseResume}
                      >
                        {run.status === 'paused' ? (
                          <>
                            <Play size={16} /> Resume
                          </>
                        ) : (
                          <>
                            <Pause size={16} /> Pause
                          </>
                        )}
                      </button>
                      <button
                        className="run-action-btn run-action-cancel"
                        onClick={handleCancel}
                      >
                        <Square size={16} /> Cancel
                      </button>
                    </div>
                  </div>
                )}

                {run.status === 'done' && (
                  <div className="run-complete">
                    <Check size={48} className="complete-icon" />
                    <h4>Complete!</h4>
                    <div className="complete-stats">
                      <span className="count-success">
                        {run.progress.success} updated
                      </span>
                      <span className="count-failed">
                        {run.progress.failed} failed
                      </span>
                      <span className="count-skipped">
                        {run.progress.skipped} skipped
                      </span>
                    </div>
                    <button className="btn btn-primary" onClick={nextStep}>
                      View Results
                    </button>
                  </div>
                )}

                {run.status === 'error' && (
                  <div className="run-error">
                    <AlertCircle size={48} className="error-icon" />
                    <h4>Error</h4>
                    <p>Something went wrong during processing.</p>
                    <button className="btn btn-primary" onClick={handleStart}>
                      Retry
                    </button>
                  </div>
                )}
              </motion.div>
            )}

            {/* Step 4: Review */}
            {step === 4 && (
              <motion.div
                key="review"
                className="autotag-step"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <h3>
                  <ListChecks size={20} />
                  Results
                </h3>

                <div className="results-summary">
                  <span className="count-success">
                    <Check size={14} /> {run.progress.success} updated
                  </span>
                  <span className="count-failed">
                    <AlertCircle size={14} /> {run.progress.failed} failed
                  </span>
                  <span className="count-skipped">
                    <RefreshCw size={14} /> {run.progress.skipped} skipped
                  </span>
                </div>

                <div className="results-table">
                  <div className="results-header">
                    <span>Status</span>
                    <span>Track</span>
                    <span>Provider</span>
                    <span>Confidence</span>
                    <span>Updated</span>
                  </div>
                  <div className="results-body">
                    {run.results.map((result, i) => (
                      <div
                        key={i}
                        className={`result-row result-${result.status}`}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          if (result.trackPath && window.electronAPI?.showItemInFolder) {
                            setContextMenu({ x: e.clientX, y: e.clientY, filePath: result.trackPath });
                          }
                        }}
                      >
                        <span className="result-status">
                          {result.status === 'success' && <Check size={14} />}
                          {result.status === 'failed' && <AlertCircle size={14} />}
                          {result.status === 'skipped' && <RefreshCw size={14} />}
                          {result.status === 'partial' && <AlertCircle size={14} />}
                        </span>
                        <span className="result-track">
                          {result.after.artist
                            ? `${result.after.artist} - ${result.after.title}`
                            : result.trackPath.split('/').pop()}
                        </span>
                        <span className="result-provider">
                          {result.matchedProvider || '-'}
                        </span>
                        <span className="result-confidence">
                          {result.confidence ? `${result.confidence}%` : '-'}
                        </span>
                        <span className="result-updated">
                          {result.updatedTags.length > 0
                            ? result.updatedTags.join(', ')
                            : result.error || '-'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {contextMenu && (
                  <>
                    <div
                      className="context-menu-overlay"
                      style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
                      onClick={() => setContextMenu(null)}
                      onContextMenu={(e) => e.preventDefault()}
                      aria-hidden
                    />
                    <div
                      ref={contextMenuRef}
                      className="context-menu"
                      style={{ left: contextMenu.x, top: contextMenu.y, zIndex: 9999 }}
                    >
                      <div className="context-menu-header">
                        <span className="context-menu-title">File</span>
                      </div>
                      <div className="context-menu-separator" />
                      <button
                        type="button"
                        className="context-menu-item"
                        onClick={() => {
                          window.electronAPI?.showItemInFolder?.(contextMenu.filePath);
                          setContextMenu(null);
                        }}
                      >
                        <FolderOpen size={16} />
                        <span>Show in Finder</span>
                      </button>
                    </div>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="autotag-footer">
          <button
            className="btn btn-secondary"
            onClick={prevStep}
            disabled={step === 0 || run.status === 'running'}
          >
            <ChevronLeft size={16} />
            Back
          </button>
          <div className="footer-spacer" />
          {step < 3 && (
            <button
              className="btn btn-primary"
              onClick={nextStep}
              disabled={!canProceed()}
            >
              Next
              <ChevronRight size={16} />
            </button>
          )}
          {step === 3 && run.status === 'idle' && (
            <button className="btn btn-primary" onClick={handleStart}>
              <Play size={16} />
              Start
            </button>
          )}
          {step === 4 && (
            <button className="btn btn-primary" onClick={closeModal}>
              Done
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
