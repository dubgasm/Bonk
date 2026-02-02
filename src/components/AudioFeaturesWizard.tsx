import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Play,
  Pause,
  Square,
  Check,
  AlertCircle,
  Music2,
  Zap,
  Activity,
  Tag,
} from 'lucide-react';
import { toast } from 'sonner';
import { useSettingsStore } from '../store/useSettingsStore';
import './AudioFeaturesWizard.css';

// Types
interface AudioFeaturesOptions {
  detectKey: boolean;
  detectBPM: boolean;
  fetchFromSpotify: boolean;
  embedISRC: boolean;  // NEW: Search Spotify and embed ISRC for better AutoTag matching
  writeToFile: boolean;
}

interface AudioFeaturesResult {
  trackPath: string;
  status: 'success' | 'partial' | 'failed';
  key?: string;
  bpm?: number;
  isrc?: string;  // NEW: ISRC from Spotify
  spotifyTrackId?: string;  // NEW: Spotify track ID for verification
  audioFeatures?: {
    danceability: number;
    energy: number;
    acousticness: number;
    instrumentalness: number;
    liveness: number;
    speechiness: number;
    valence: number;
  };
  error?: string;
}

interface AudioFeaturesEvent {
  runId: string;
  type: string;
  timestamp: number;
  current?: number;
  total?: number;
  track?: { path: string; name: string };
  result?: AudioFeaturesResult;
  error?: string;
}

interface AudioFeaturesWizardProps {
  isOpen: boolean;
  onClose: () => void;
  selectedFiles: string[];
}

type WizardStep = 'options' | 'run' | 'results';

export function AudioFeaturesWizard({ isOpen, onClose, selectedFiles }: AudioFeaturesWizardProps) {
  const { apiCredentials } = useSettingsStore();
  
  // State
  const [step, setStep] = useState<WizardStep>('options');
  const [options, setOptions] = useState<AudioFeaturesOptions>({
    detectKey: true,
    detectBPM: true,
    fetchFromSpotify: false,
    embedISRC: true,  // Enable by default - helps AutoTag
    writeToFile: true,
  });
  
  // Run state
  const [runId, setRunId] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [currentTrack, setCurrentTrack] = useState<string>('');
  const [results, setResults] = useState<AudioFeaturesResult[]>([]);
  const [events, setEvents] = useState<string[]>([]);
  
  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setStep('options');
      setResults([]);
      setEvents([]);
      setProgress({ current: 0, total: 0 });
      setIsRunning(false);
      setIsPaused(false);
    }
  }, [isOpen]);
  
  // Event listener
  useEffect(() => {
    if (!window.electronAPI?.onAudioFeaturesEvent) return;
    
    const handleEvent = (event: AudioFeaturesEvent) => {
      if (runId && event.runId !== runId) return;
      
      switch (event.type) {
        case 'started':
          setProgress({ current: 0, total: event.total || 0 });
          setEvents(prev => [...prev, `Started analyzing ${event.total} files...`]);
          break;
        case 'track_start':
          setCurrentTrack(event.track?.name || '');
          break;
        case 'track_complete':
          setProgress({ current: event.current || 0, total: event.total || 0 });
          if (event.result) {
            setResults(prev => [...prev, event.result!]);
            const keyInfo = event.result.key ? `Key: ${event.result.key}` : '';
            const bpmInfo = event.result.bpm ? `BPM: ${event.result.bpm}` : '';
            const isrcInfo = event.result.isrc ? `ISRC: ${event.result.isrc}` : '';
            setEvents(prev => [...prev, `✓ ${event.track?.name}: ${[keyInfo, bpmInfo, isrcInfo].filter(Boolean).join(', ') || 'No data'}`]);
          }
          break;
        case 'track_failed':
          setProgress({ current: event.current || 0, total: event.total || 0 });
          setEvents(prev => [...prev, `✗ ${event.track?.name}: ${event.error}`]);
          break;
        case 'completed':
          setIsRunning(false);
          setStep('results');
          toast.success(`Audio analysis complete!`);
          break;
        case 'cancelled':
          setIsRunning(false);
          setEvents(prev => [...prev, 'Analysis cancelled']);
          break;
      }
    };
    
    window.electronAPI.onAudioFeaturesEvent(handleEvent);
    
    return () => {
      window.electronAPI?.removeAudioFeaturesListeners?.();
    };
  }, [runId]);
  
  // Start analysis
  const startAnalysis = useCallback(async () => {
    if (selectedFiles.length === 0) {
      toast.error('No files selected');
      return;
    }
    
    const newRunId = `af_${Date.now()}`;
    setRunId(newRunId);
    setIsRunning(true);
    setIsPaused(false);
    setResults([]);
    setEvents([]);
    setStep('run');
    
    try {
      await window.electronAPI?.audioFeaturesStart?.({
        runId: newRunId,
        files: selectedFiles,
        options,
        credentials: {
          spotifyClientId: apiCredentials?.spotifyClientId || '',
          spotifyClientSecret: apiCredentials?.spotifyClientSecret || '',
        },
      });
    } catch (e) {
      console.error('Audio features error:', e);
      setIsRunning(false);
      toast.error('Failed to start audio analysis');
    }
  }, [selectedFiles, options, apiCredentials]);
  
  // Pause/Resume
  const togglePause = useCallback(async () => {
    if (!runId) return;
    
    if (isPaused) {
      await window.electronAPI?.audioFeaturesResume?.(runId);
      setIsPaused(false);
    } else {
      await window.electronAPI?.audioFeaturesPause?.(runId);
      setIsPaused(true);
    }
  }, [runId, isPaused]);
  
  // Cancel
  const cancelAnalysis = useCallback(async () => {
    if (!runId) return;
    await window.electronAPI?.audioFeaturesCancel?.(runId);
    setIsRunning(false);
  }, [runId]);
  
  // Close handler
  const handleClose = () => {
    if (isRunning) {
      if (confirm('Analysis is in progress. Are you sure you want to cancel?')) {
        cancelAnalysis();
        onClose();
      }
    } else {
      onClose();
    }
  };
  
  if (!isOpen) return null;
  
  // Calculate stats
  const successCount = results.filter(r => r.status === 'success').length;
  const partialCount = results.filter(r => r.status === 'partial').length;
  const failedCount = results.filter(r => r.status === 'failed').length;
  
  return (
    <div className="af-wizard-overlay" onClick={handleClose}>
      <motion.div
        className="af-wizard-modal"
        onClick={e => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
      >
        {/* Header */}
        <div className="af-wizard-header">
          <div className="af-wizard-title">
            <Activity size={24} />
            <span>Audio Features Analysis</span>
          </div>
          <button className="af-wizard-close" onClick={handleClose}>
            <X size={20} />
          </button>
        </div>
        
        {/* Content */}
        <div className="af-wizard-content">
          <AnimatePresence mode="wait">
            {/* Step 1: Options */}
            {step === 'options' && (
              <motion.div
                key="options"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="af-step"
              >
                <div className="af-step-header">
                  <h3>Analysis Options</h3>
                  <p className="af-step-desc">
                    {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} selected for analysis
                  </p>
                </div>
                
                <div className="af-options-grid">
                  <label className="af-option">
                    <input
                      type="checkbox"
                      checked={options.detectKey}
                      onChange={e => setOptions(prev => ({ ...prev, detectKey: e.target.checked }))}
                    />
                    <div className="af-option-content">
                      <Music2 size={20} />
                      <div>
                        <strong>Detect Key</strong>
                        <span>Analyze audio to detect musical key using keyfinder</span>
                      </div>
                    </div>
                  </label>
                  
                  <label className="af-option">
                    <input
                      type="checkbox"
                      checked={options.detectBPM}
                      onChange={e => setOptions(prev => ({ ...prev, detectBPM: e.target.checked }))}
                    />
                    <div className="af-option-content">
                      <Zap size={20} />
                      <div>
                        <strong>Get BPM</strong>
                        <span>Read BPM from file metadata</span>
                      </div>
                    </div>
                  </label>
                  
                  <label className="af-option">
                    <input
                      type="checkbox"
                      checked={options.embedISRC}
                      onChange={e => setOptions(prev => ({ ...prev, embedISRC: e.target.checked }))}
                    />
                    <div className="af-option-content">
                      <Tag size={20} />
                      <div>
                        <strong>Embed ISRC from Spotify</strong>
                        <span>Search Spotify and embed ISRC code (helps AutoTag find exact matches)</span>
                      </div>
                    </div>
                  </label>
                  
                  <label className="af-option">
                    <input
                      type="checkbox"
                      checked={options.fetchFromSpotify}
                      onChange={e => setOptions(prev => ({ ...prev, fetchFromSpotify: e.target.checked }))}
                    />
                    <div className="af-option-content">
                      <Activity size={20} />
                      <div>
                        <strong>Fetch Audio Features</strong>
                        <span>Get energy, danceability, etc. from Spotify (deprecated API)</span>
                      </div>
                    </div>
                  </label>
                  
                  <label className="af-option">
                    <input
                      type="checkbox"
                      checked={options.writeToFile}
                      onChange={e => setOptions(prev => ({ ...prev, writeToFile: e.target.checked }))}
                    />
                    <div className="af-option-content">
                      <Check size={20} />
                      <div>
                        <strong>Write to File</strong>
                        <span>Save detected values to file metadata</span>
                      </div>
                    </div>
                  </label>
                </div>
                
                <div className="af-actions">
                  <button className="af-btn af-btn-secondary" onClick={handleClose}>
                    Cancel
                  </button>
                  <button
                    className="af-btn af-btn-primary"
                    onClick={startAnalysis}
                    disabled={!options.detectKey && !options.detectBPM && !options.fetchFromSpotify && !options.embedISRC}
                  >
                    <Play size={16} />
                    Start Analysis
                  </button>
                </div>
              </motion.div>
            )}
            
            {/* Step 2: Running */}
            {step === 'run' && (
              <motion.div
                key="run"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="af-step"
              >
                <div className="af-step-header">
                  <h3>Analyzing Audio...</h3>
                  <p className="af-step-desc">
                    {progress.current} / {progress.total} files processed
                  </p>
                </div>
                
                <div className="af-progress-bar">
                  <div
                    className="af-progress-fill"
                    style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
                  />
                </div>
                
                <div className="af-current-track">
                  {currentTrack && <span>Processing: {currentTrack}</span>}
                </div>
                
                <div className="af-events-log">
                  {events.slice(-10).map((event, i) => (
                    <div key={i} className="af-event-item">{event}</div>
                  ))}
                </div>
                
                <div className="af-actions">
                  <button className="af-btn af-btn-secondary" onClick={cancelAnalysis}>
                    <Square size={16} />
                    Cancel
                  </button>
                  <button className="af-btn af-btn-secondary" onClick={togglePause}>
                    {isPaused ? <Play size={16} /> : <Pause size={16} />}
                    {isPaused ? 'Resume' : 'Pause'}
                  </button>
                </div>
              </motion.div>
            )}
            
            {/* Step 3: Results */}
            {step === 'results' && (
              <motion.div
                key="results"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="af-step"
              >
                <div className="af-step-header">
                  <h3>Analysis Complete!</h3>
                  <div className="af-results-summary">
                    <span className="af-stat af-stat-success">
                      <Check size={16} /> {successCount} analyzed
                    </span>
                    <span className="af-stat af-stat-partial">
                      <AlertCircle size={16} /> {partialCount} partial
                    </span>
                    <span className="af-stat af-stat-failed">
                      <X size={16} /> {failedCount} failed
                    </span>
                  </div>
                </div>
                
                <div className="af-results-list">
                  {results.map((result, i) => (
                    <div key={i} className={`af-result-item af-result-${result.status}`}>
                      <div className="af-result-name">
                        {result.trackPath.split('/').pop()}
                      </div>
                      <div className="af-result-data">
                        {result.key && <span className="af-result-tag">Key: {result.key}</span>}
                        {result.bpm && <span className="af-result-tag">BPM: {result.bpm}</span>}
                        {result.isrc && <span className="af-result-tag af-result-isrc">ISRC: {result.isrc}</span>}
                        {result.audioFeatures && (
                          <>
                            <span className="af-result-tag">Energy: {result.audioFeatures.energy}%</span>
                            <span className="af-result-tag">Dance: {result.audioFeatures.danceability}%</span>
                          </>
                        )}
                        {result.error && <span className="af-result-error">{result.error}</span>}
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="af-actions">
                  <button className="af-btn af-btn-primary" onClick={handleClose}>
                    Done
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}

export default AudioFeaturesWizard;
