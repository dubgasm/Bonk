import React, { useEffect, useMemo, useRef, useState } from 'react';

type CanvasWaveformProps = {
  peaks: number[]; // normalized 0..1
  durationMs: number;
  positionMs: number;
  isPlaying: boolean;
  onSeek: (targetMs: number) => void;
  height?: number;
  className?: string;
};

function clamp01(x: number) {
  return Math.min(1, Math.max(0, x));
}

function useSmoothPosition(positionMs: number, isPlaying: boolean) {
  const [displayMs, setDisplayMs] = useState(positionMs);
  const baseRef = useRef({
    baseMs: positionMs,
    baseAt: typeof performance !== 'undefined' ? performance.now() : 0,
    playing: isPlaying,
  });

  useEffect(() => {
    baseRef.current = {
      baseMs: positionMs,
      baseAt: typeof performance !== 'undefined' ? performance.now() : 0,
      playing: isPlaying,
    };
    setDisplayMs(positionMs);
  }, [positionMs, isPlaying]);

  useEffect(() => {
    let raf = 0;

    const tick = () => {
      const { baseMs, baseAt, playing } = baseRef.current;
      const now = typeof performance !== 'undefined' ? performance.now() : 0;

      if (playing) {
        const next = baseMs + (now - baseAt);
        setDisplayMs(next);
      } else {
        setDisplayMs(baseMs);
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return displayMs;
}

export const CanvasWaveform: React.FC<CanvasWaveformProps> = ({
  peaks,
  durationMs,
  positionMs,
  isPlaying,
  onSeek,
  height = 24,
  className,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const displayMs = useSmoothPosition(positionMs, isPlaying);

  const progress = useMemo(() => {
    if (!durationMs || durationMs <= 0) return 0;
    return clamp01(displayMs / durationMs);
  }, [displayMs, durationMs]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const cssWidth = wrap.clientWidth;
    const cssHeight = height;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(cssWidth * dpr));
    canvas.height = Math.max(1, Math.floor(cssHeight * dpr));
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssWidth, cssHeight);

    const unplayed = 'rgba(255,255,255,0.28)';
    const played = '#1db954';

    const n = peaks?.length ?? 0;
    if (n <= 0 || cssWidth <= 0) {
      ctx.fillStyle = unplayed;
      ctx.fillRect(0, cssHeight - 1, cssWidth, 1);
      return;
    }

    const barCount = n;
    const barW = cssWidth / barCount;
    const centerY = cssHeight / 2;

    const drawBars = (color: string) => {
      ctx.fillStyle = color;
      for (let i = 0; i < barCount; i++) {
        const amp = clamp01(peaks[i]);
        const barH = Math.max(1, Math.floor(amp * cssHeight));
        const x = i * barW;
        const y = Math.floor(centerY - barH / 2);
        const w = Math.max(1, Math.floor(barW));
        ctx.fillRect(Math.floor(x), y, w, barH);
      }
    };

    // Unplayed first
    drawBars(unplayed);

    // Played region clipped
    const playedPx = cssWidth * progress;
    if (playedPx > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, playedPx, cssHeight);
      ctx.clip();
      drawBars(played);
      ctx.restore();
    }
  }, [peaks, progress, height]);

  const handleClick = (e: React.MouseEvent) => {
    if (!durationMs || durationMs <= 0) return;
    const wrap = wrapRef.current;
    if (!wrap) return;

    const rect = wrap.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = clamp01(x / rect.width);
    const targetMs = Math.round(ratio * durationMs);
    onSeek(targetMs);
  };

  return (
    <div
      ref={wrapRef}
      className={className}
      style={{ position: 'relative', width: '100%', height, cursor: 'pointer' }}
      onClick={handleClick}
    >
      <canvas ref={canvasRef} />
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          width: 2,
          left: `${progress * 100}%`,
          transform: 'translateX(-1px)',
          background: '#1db954',
          pointerEvents: 'none',
          opacity: 0.95,
        }}
      />
    </div>
  );
};

