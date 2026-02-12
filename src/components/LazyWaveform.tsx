import { useEffect, useState, memo } from 'react';
import { CanvasWaveform } from './CanvasWaveform';

interface LazyWaveformProps {
  trackId: string;
  location?: string;
  height?: number;
}

// Global cache for waveform peaks to prevent re-fetching on scroll
const waveformCache = new Map<string, number[]>();

export default memo(function LazyWaveform({ trackId, location, height = 24 }: LazyWaveformProps) {
  const [peaks, setPeaks] = useState<number[] | null>(waveformCache.get(trackId) || null);
  const [loading, setLoading] = useState(!peaks);

  useEffect(() => {
    if (!location) return;
    if (waveformCache.has(trackId)) {
      setPeaks(waveformCache.get(trackId)!);
      setLoading(false);
      return;
    }

    let cancelled = false;

    // Debounce the fetch to prevent loading waveforms for tracks that are just scrolling by
    const timeoutId = setTimeout(() => {
      const loadWaveform = async () => {
        try {
          // If we already have a request in flight or component unmounted, don't proceed (double check)
          if (cancelled) return;

          setLoading(true);
          // Use a lower resolution for the table column to save memory/perf
          const points = 100; 
          
          // Normalize path
          let filePath = location;
          if (filePath.startsWith('file://localhost/')) filePath = filePath.replace('file://localhost/', '/');
          else if (filePath.startsWith('file://')) filePath = filePath.replace('file://', '');
          try { filePath = decodeURIComponent(filePath); } catch {}

          if (window.electronAPI?.rustAudioGetWaveform) {
            const result = await window.electronAPI.rustAudioGetWaveform(filePath, points);
            if (!cancelled && result.success && result.waveform?.peaks) {
              waveformCache.set(trackId, result.waveform.peaks);
              setPeaks(result.waveform.peaks);
            }
          }
        } catch (err) {
          console.error('Failed to load waveform for track', trackId, err);
        } finally {
          if (!cancelled) setLoading(false);
        }
      };

      loadWaveform();
    }, 150); // 150ms delay - enough to skip rows during fast scroll

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [trackId, location]);

  if (loading || !peaks) {
    return (
      <div 
        className="waveform-placeholder" 
        style={{ 
          width: '100%', 
          height: `${height}px`, 
          background: 'rgba(255,255,255,0.05)', 
          borderRadius: '2px',
          opacity: loading ? 0.5 : 0.2
        }} 
      />
    );
  }

  return (
    <div style={{ width: '100%', height: `${height}px`, opacity: 0.8 }}>
      <CanvasWaveform
        peaks={peaks}
        durationMs={100} // Dummy duration, we just want to render the shape
        positionMs={0}
        isPlaying={false}
        onSeek={() => {}} // No-op for now
        height={height}
        dragSeekMode="release"
      />
    </div>
  );
});
