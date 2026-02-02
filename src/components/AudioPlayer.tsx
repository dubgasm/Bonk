import { useState, useEffect, useRef } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Plus, Trash2, Edit2, X } from 'lucide-react';
import { Track, CuePoint } from '../types/track';
import { useLibraryStore } from '../store/useLibraryStore';
import { toast } from 'sonner';
import './AudioPlayer.css';

interface AudioPlayerProps {
  track: Track;
  onClose?: () => void;
}

const CUE_COLORS = [
  { name: 'Red', hex: '#FF0000' },
  { name: 'Orange', hex: '#FF8C00' },
  { name: 'Yellow', hex: '#FFD700' },
  { name: 'Green', hex: '#00FF00' },
  { name: 'Blue', hex: '#0080FF' },
  { name: 'Purple', hex: '#A020F0' },
  { name: 'Pink', hex: '#FF69B4' },
  { name: 'White', hex: '#FFFFFF' },
];

export default function AudioPlayer({ track, onClose }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.75);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cuePoints, setCuePoints] = useState<CuePoint[]>(track.CuePoints || []);
  const [editingCue, setEditingCue] = useState<CuePoint | null>(null);
  const [showAddCue, setShowAddCue] = useState(false);
  const cancelledRef = useRef(false);
  const { updateTrack } = useLibraryStore();

  const getFilePath = (location: string): string => {
    try {
      let p = String(location ?? '');
      if (p.startsWith('file://localhost/')) p = p.replace('file://localhost/', '/');
      else if (p.startsWith('file://')) p = p.replace('file://', '');
      return decodeURIComponent(p);
    } catch {
      return '';
    }
  };

  useEffect(() => {
    cancelledRef.current = false;
    const filePath = getFilePath(track.Location || '');
    if (!filePath) {
      setError('Invalid file path');
      setIsLoading(false);
      return;
    }

    const fileExt = (filePath.split('.').pop() || '').toLowerCase();
    const alwaysTranscode = ['wma', 'aiff', 'aif'].includes(fileExt);
    const api = (window as any).electronAPI;

    const loadAndPlay = async () => {
      try {
        let url: string;
        if (alwaysTranscode && api?.transcodeForAudition) {
          const res = await api.transcodeForAudition(filePath);
          if (cancelledRef.current) return;
          if (!res?.success || !res?.url) {
            setError(res?.error || 'Transcoding failed');
            setIsLoading(false);
            return;
          }
          url = res.url;
        } else {
          url = `media://${filePath}`;
        }

        if (cancelledRef.current) return;
        const audio = new Audio(url);
        audioRef.current = audio;

        audio.addEventListener('loadedmetadata', () => {
          if (!cancelledRef.current) {
            setDuration(audio.duration);
          }
        });
        audio.addEventListener('timeupdate', () => {
          if (!cancelledRef.current) setCurrentTime(audio.currentTime);
        });
        audio.addEventListener('play', () => { if (!cancelledRef.current) setIsPlaying(true); });
        audio.addEventListener('pause', () => { if (!cancelledRef.current) setIsPlaying(false); });
        audio.addEventListener('ended', () => { if (!cancelledRef.current) setIsPlaying(false); });
        audio.addEventListener('error', () => {
          if (!cancelledRef.current) {
            if (!alwaysTranscode && api?.transcodeForAudition) {
              api.transcodeForAudition(filePath).then((res: any) => {
                if (cancelledRef.current) return;
                if (res?.success && res?.url) {
                  audio.src = res.url;
                  audio.load();
                } else {
                  setError('Failed to load audio');
                  setIsLoading(false);
                }
              });
            } else {
              setError('Failed to load audio');
              setIsLoading(false);
            }
          }
        });
        audio.addEventListener('canplay', () => {
          if (!cancelledRef.current) {
            setIsLoading(false);
            setError(null);
            setDuration(audio.duration);
            toast.success('Audio loaded');
          }
        });

        audio.volume = volume;
        audio.load();
      } catch (e) {
        if (!cancelledRef.current) {
          setError(e instanceof Error ? e.message : 'Load failed');
          setIsLoading(false);
        }
      }
    };

    loadAndPlay();

    return () => {
      cancelledRef.current = true;
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
      audioRef.current = null;
    };
  }, [track.TrackID, track.Location]);

  const togglePlay = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) a.play();
    else a.pause();
  };

  const skip = (seconds: number) => {
    const a = audioRef.current;
    if (!a || !isFinite(a.duration)) return;
    a.currentTime = Math.max(0, Math.min(a.duration, currentTime + seconds));
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    if (audioRef.current) audioRef.current.volume = v;
  };

  const toggleMute = () => {
    const a = audioRef.current;
    if (a) a.volume = isMuted ? volume : 0;
    setIsMuted(!isMuted);
  };

  const jumpToCue = (cue: CuePoint) => {
    const a = audioRef.current;
    if (!a) return;
    const time = parseFloat(cue.Start || '0') / 1000;
    a.currentTime = time;
    setCurrentTime(time);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const a = audioRef.current;
    if (!a || !isFinite(a.duration)) return;
    const t = parseFloat(e.target.value) * a.duration;
    a.currentTime = t;
    setCurrentTime(t);
  };

  const handleAddCue = () => {
    const newCue: CuePoint = {
      Name: `Cue ${cuePoints.length + 1}`,
      Type: '0',
      Start: (currentTime * 1000).toString(),
      Num: cuePoints.length.toString(),
      Red: '59',
      Green: '130',
      Blue: '246',
    };
    const updated = [...cuePoints, newCue];
    setCuePoints(updated);
    updateTrack(track.TrackID, { CuePoints: updated });
    toast.success('Cue point added');
    setShowAddCue(false);
  };

  const handleDeleteCue = (index: number) => {
    const updated = cuePoints.filter((_, i) => i !== index);
    setCuePoints(updated);
    updateTrack(track.TrackID, { CuePoints: updated });
    toast.success('Cue point deleted');
  };

  const handleUpdateCue = (index: number, updates: Partial<CuePoint>) => {
    const updated = cuePoints.map((c, i) => (i === index ? { ...c, ...updates } : c));
    setCuePoints(updated);
    updateTrack(track.TrackID, { CuePoints: updated });
    setEditingCue(null);
    toast.success('Cue point updated');
  };

  const formatTime = (s: number): string => {
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const rgbToHex = (r: string, g: string, b: string): string => {
    const toHex = (n: string) => {
      const hex = parseInt(n).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
  };

  const prog = duration > 0 ? currentTime / duration : 0;

  return (
    <div className="audio-player">
      <div className="audio-player-header">
        <div className="player-track-info">
          <h3>{track.Name}</h3>
          <p>{track.Artist}</p>
        </div>
        {onClose && (
          <button className="player-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        )}
      </div>

      {error ? (
        <div className="player-error">
          <p>{error}</p>
        </div>
      ) : (
        <>
          <div className="player-controls">
            <button className="control-btn" onClick={() => skip(-10)} title="Back 10s">
              <SkipBack size={20} />
            </button>
            <button
              className="control-btn control-btn-primary"
              onClick={togglePlay}
              disabled={isLoading}
            >
              {isPlaying ? <Pause size={24} /> : <Play size={24} />}
            </button>
            <button className="control-btn" onClick={() => skip(10)} title="Forward 10s">
              <SkipForward size={20} />
            </button>
            <div className="time-display">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
            <div className="volume-control">
              <button className="control-btn" onClick={toggleMute}>
                {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="volume-slider"
              />
            </div>
          </div>

          <div className="progress-section">
            {isLoading && (
              <div className="progress-loading">
                <div className="spinner"></div>
                <p>Loading...</p>
              </div>
            )}
            <input
              type="range"
              min="0"
              max="1"
              step="0.001"
              value={prog}
              onChange={handleSeek}
              disabled={isLoading || !isFinite(duration)}
              className="progress-slider"
            />
          </div>

          <div className="cue-points-section">
            <div className="cue-points-header">
              <h4>Cue Points ({cuePoints.length})</h4>
              <button className="btn btn-sm btn-primary" onClick={() => setShowAddCue(true)}>
                <Plus size={14} />
                Add Cue
              </button>
            </div>

            {showAddCue && (
              <div className="add-cue-form">
                <p>Add cue at {formatTime(currentTime)}</p>
                <div className="add-cue-actions">
                  <button className="btn btn-secondary" onClick={() => setShowAddCue(false)}>Cancel</button>
                  <button className="btn btn-primary" onClick={handleAddCue}>
                    <Plus size={14} /> Add Cue
                  </button>
                </div>
              </div>
            )}

            <div className="cue-points-list">
              {cuePoints.length === 0 ? (
                <p className="no-cues">No cue points. Add one while playing!</p>
              ) : (
                cuePoints.map((cue, index) => (
                  <div key={index} className="cue-point-item">
                    {editingCue?.Num === cue.Num ? (
                      <div className="cue-edit-form">
                        <input
                          type="text"
                          value={editingCue.Name}
                          onChange={(e) => setEditingCue({ ...editingCue, Name: e.target.value })}
                          placeholder="Cue name"
                        />
                        <select
                          value={rgbToHex(editingCue.Red || '59', editingCue.Green || '130', editingCue.Blue || '246')}
                          onChange={(e) => {
                            const hex = e.target.value;
                            const r = parseInt(hex.slice(1, 3), 16);
                            const g = parseInt(hex.slice(3, 5), 16);
                            const b = parseInt(hex.slice(5, 7), 16);
                            setEditingCue({ ...editingCue, Red: r.toString(), Green: g.toString(), Blue: b.toString() });
                          }}
                        >
                          {CUE_COLORS.map((c) => (
                            <option key={c.hex} value={c.hex}>{c.name}</option>
                          ))}
                        </select>
                        <button className="btn btn-sm btn-primary" onClick={() => handleUpdateCue(index, editingCue)}>Save</button>
                        <button className="btn btn-sm btn-secondary" onClick={() => setEditingCue(null)}>Cancel</button>
                      </div>
                    ) : (
                      <>
                        <div
                          className="cue-color"
                          style={{ backgroundColor: `rgb(${cue.Red || 59}, ${cue.Green || 130}, ${cue.Blue || 246})` }}
                        />
                        <div className="cue-info">
                          <span className="cue-name">{cue.Name || `Cue ${index + 1}`}</span>
                          <span className="cue-time">{formatTime(parseFloat(cue.Start) / 1000)}</span>
                        </div>
                        <div className="cue-actions">
                          <button className="btn-icon-sm" onClick={() => jumpToCue(cue)} title="Jump to cue">
                            <Play size={14} />
                          </button>
                          <button className="btn-icon-sm" onClick={() => setEditingCue(cue)} title="Edit cue">
                            <Edit2 size={14} />
                          </button>
                          <button className="btn-icon-sm btn-danger" onClick={() => handleDeleteCue(index)} title="Delete cue">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
