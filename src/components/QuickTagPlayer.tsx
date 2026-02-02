import { useEffect, useRef, useState } from 'react';
import { Play, Pause, Volume2, VolumeX, FolderOpen } from 'lucide-react';
import { Track } from '../types/track';
import { CanvasWaveform } from './CanvasWaveform';

// Single place to tweak waveform resolution for Quick Tag footer
// Good ranges to try based on @WaveForm.md:
// - 600  => very thick bars, very simple shape
// - 800  => thick bars, simple shape
// - 1000 => nice balance for our current height
// - 1200 => more detail if we ever make the player taller
const DEFAULT_WAVEFORM_POINTS = 1000;

interface QuickTagPlayerProps {
  track: Track;
  onChooseFolder: () => void;
  autoPlay?: boolean;
  startPlaybackAfterSeek?: boolean;
  onPlaybackEnded?: () => void;
  /** When parent seeks (e.g. arrow keys), pass the new position so waveform/needle update immediately */
  externalSeekTargetSeconds?: number | null;
  onExternalSeekConsumed?: () => void;
}

const formatTime = (s: number): string => {
  if (!isFinite(s) || s < 0) return '0:00';
  const mins = Math.floor(s / 60);
  const secs = Math.floor(s % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export default function QuickTagPlayer({ track, onChooseFolder, autoPlay, startPlaybackAfterSeek, onPlaybackEnded, externalSeekTargetSeconds, onExternalSeekConsumed }: QuickTagPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [volume, setVolume] = useState(0.9);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const animationRef = useRef<number | null>(null);
  const usingRustRef = useRef(false);
  const lastKnownPosRef = useRef(0); // seconds
  const playStartRef = useRef<number | null>(null); // performance.now()
  const hasCalledOnEndRef = useRef(false);
  const [waveform, setWaveform] = useState<number[] | null>(null);
  const onExternalSeekConsumedRef = useRef(onExternalSeekConsumed);
  onExternalSeekConsumedRef.current = onExternalSeekConsumed;

  const getFilePath = (location: string | undefined): string => {
    if (!location) return '';
    let p = String(location ?? '');
    if (p.startsWith('file://localhost/')) p = p.replace('file://localhost/', '/');
    else if (p.startsWith('file://')) p = p.replace('file://', '');
    try {
      return decodeURIComponent(p);
    } catch {
      return p;
    }
  };

  useEffect(() => {
    const api = window.electronAPI;
    let cancelled = false;

    const load = async () => {
      try {
        setIsLoading(true);
        setError(null);
        setIsPlaying(false);
        setPosition(0);
        lastKnownPosRef.current = 0;
        playStartRef.current = null;
        hasCalledOnEndRef.current = false;

        if (!api.rustAudioInit || !api.rustAudioLoad) {
          throw new Error('Rust audio backend is not available.');
        }

        const initRes = await api.rustAudioInit();
        if (!initRes?.success) {
          throw new Error(initRes?.error || 'Failed to init audio backend');
        }

        usingRustRef.current = true;

        const filePath = getFilePath(track.Location);
        if (!filePath) {
          throw new Error('Track has no valid file path');
        }

        const [loadRes, wfRes] = await Promise.all([
          api.rustAudioLoad(filePath),
          api.rustAudioGetWaveform?.(filePath, DEFAULT_WAVEFORM_POINTS),
        ]);
        if (cancelled) return;

        if (!loadRes?.success) {
          throw new Error(loadRes?.error || 'Failed to load audio file');
        }

        const dur = loadRes.duration ?? 0;
        setDuration(dur);

        if (wfRes?.success && wfRes.waveform?.peaks) {
          const peaks = wfRes.waveform.peaks;
          console.log('Waveform loaded:', peaks.length, 'peaks');
          console.log('Sample peaks (first 20):', peaks.slice(0, 20));
          console.log('Peak values range:', {
            min: Math.min(...peaks),
            max: Math.max(...peaks),
            avg: peaks.reduce((a, b) => a + b, 0) / peaks.length,
          });
          console.log('Non-zero peaks:', peaks.filter(p => p > 0.01).length);
          setWaveform(peaks);
        } else if (wfRes && !wfRes.success) {
          console.error('Waveform error:', wfRes.error);
          setWaveform(null);
        } else {
          console.warn('No waveform response', wfRes);
          setWaveform(null);
        }
        // Auto-play after load if requested, otherwise ensure we're paused at start
        if (autoPlay) {
          try {
            await api.rustAudioPlay?.();
            playStartRef.current = performance.now();
            setIsPlaying(true);
          } catch (err) {
            console.error('QuickTagPlayer autoPlay error:', err);
          }
        } else {
          try {
            await api.rustAudioPause?.();
          } catch (err) {
            console.error('QuickTagPlayer pause after load error:', err);
          }
          lastKnownPosRef.current = 0;
          playStartRef.current = null;
          setIsPlaying(false);
          setPosition(0);
        }

        setIsLoading(false);

        // Start smooth playhead animation using requestAnimationFrame
        if (animationRef.current != null) {
          cancelAnimationFrame(animationRef.current);
        }
        const animate = () => {
          if (cancelled) return;
          if (playStartRef.current != null && duration > 0) {
            const elapsed = (performance.now() - playStartRef.current) / 1000;
            const pos = Math.min(duration, lastKnownPosRef.current + elapsed);
            setPosition(pos);
            if (pos >= Math.max(0, duration - 0.3) && !hasCalledOnEndRef.current) {
              hasCalledOnEndRef.current = true;
              playStartRef.current = null;
              setIsPlaying(false);
              onPlaybackEnded?.();
            }
          }
          animationRef.current = requestAnimationFrame(animate);
        };
        animationRef.current = requestAnimationFrame(animate);
      } catch (e: any) {
        if (!cancelled) {
          setError(e.message || 'Failed to initialize player');
          setIsLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
      if (animationRef.current != null) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      if (usingRustRef.current) {
        window.electronAPI.rustAudioStop?.();
      }
    };
  }, [track.TrackID, track.Location, autoPlay, onPlaybackEnded]);

  // When parent seeks via arrow keys, sync position/ref so waveform and needle update immediately
  useEffect(() => {
    if (externalSeekTargetSeconds == null || !Number.isFinite(externalSeekTargetSeconds)) return;
    const sec = Math.max(0, Math.min(duration, externalSeekTargetSeconds));
    lastKnownPosRef.current = sec;
    setPosition(sec);
    if (isPlaying) playStartRef.current = performance.now();
    onExternalSeekConsumedRef.current?.();
  }, [externalSeekTargetSeconds, duration, isPlaying]);

  const togglePlay = async () => {
    if (!usingRustRef.current) return;
    const api = window.electronAPI;
    try {
      if (isPlaying) {
        await api.rustAudioPause?.();
        if (playStartRef.current != null) {
          const elapsed = (performance.now() - playStartRef.current) / 1000;
          lastKnownPosRef.current = Math.min(duration, lastKnownPosRef.current + elapsed);
          setPosition(lastKnownPosRef.current);
          playStartRef.current = null;
        }
        setIsPlaying(false);
      } else {
        await api.rustAudioPlay?.();
        playStartRef.current = performance.now();
        setIsPlaying(true);
      }
    } catch (e) {
      console.error('QuickTagPlayer togglePlay error:', e);
    }
  };

  const handleVolumeChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    const api = window.electronAPI;
    try {
      await api.rustAudioSetVolume?.(v);
    } catch (err) {
      console.error('QuickTagPlayer volume error:', err);
    }
  };

  const toggleMute = async () => {
    const api = window.electronAPI;
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    try {
      await api.rustAudioSetVolume?.(nextMuted ? 0 : volume);
    } catch (err) {
      console.error('QuickTagPlayer mute error:', err);
    }
  };

  const handleSeekMs = async (targetMs: number) => {
    if (!usingRustRef.current || duration <= 0) return;
    const api = window.electronAPI;
    const targetSeconds = targetMs / 1000;

    try {
      await api.rustAudioSeek?.(targetSeconds);
      lastKnownPosRef.current = targetSeconds;
      setPosition(targetSeconds);
      if (startPlaybackAfterSeek) {
        await api.rustAudioPlay?.();
        playStartRef.current = performance.now();
        setIsPlaying(true);
      } else {
        playStartRef.current = null;
      }
    } catch (err) {
      console.error('QuickTagPlayer seek error:', err);
    }
  };

  const durationMs = duration * 1000;
  const positionMs = position * 1000;

  return (
    <div className="quicktag-player">
      <div className="quicktag-player-left">
        <button
          className="quicktag-player-btn"
          onClick={togglePlay}
          disabled={isLoading || !!error}
        >
          {isPlaying ? <Pause size={20} /> : <Play size={20} />}
        </button>
        <div className="quicktag-player-meta">
          <div className="quicktag-player-title">{track.Name}</div>
          {track.Artist && <div className="quicktag-player-artist">{track.Artist}</div>}
        </div>
      </div>

      <div className="quicktag-player-center">
        {error ? (
          <div className="quicktag-player-error">{error}</div>
        ) : (
          <div className="quicktag-player-center-inner">
            <CanvasWaveform
              peaks={waveform || []}
              durationMs={durationMs}
              positionMs={positionMs}
              isPlaying={isPlaying}
              onSeek={handleSeekMs}
              height={44}
              className="quicktag-wave-wrap"
            />
            <div className="quicktag-player-time">
              <span>{formatTime(position)}</span>
              <span>/</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
        )}
      </div>

      <div className="quicktag-player-right">
        <button
          className="quicktag-player-btn quicktag-player-btn-secondary"
          onClick={onChooseFolder}
          disabled={isLoading}
          title="Choose folder…"
        >
          <FolderOpen size={16} />
        </button>
        <button className="quicktag-player-btn" onClick={toggleMute}>
          {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={isMuted ? 0 : volume}
          onChange={handleVolumeChange}
          className="quicktag-player-volume"
        />
      </div>
    </div>
  );
}

