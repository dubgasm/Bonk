import React, { useEffect, useMemo, useRef, useState } from "react";

type CanvasWaveformProps = {
  peaks: number[];                // normalized 0..1
  durationMs: number;
  positionMs: number;             // backend position ticks
  isPlaying: boolean;
  onSeek: (targetMs: number) => void;

  height?: number;                // visual waveform height
  className?: string;

  // Drag behavior hookup:
  // - "release" = seek only on pointer up (smoothest audio, fewer seeks)
  // - "throttle" = seek during drag (more responsive audio, more backend calls)
  dragSeekMode?: "release" | "throttle";

  // How many seeks per second during drag if dragSeekMode="throttle"
  dragSeekHz?: number;
};

function clamp01(x: number) {
  return Math.min(1, Math.max(0, x));
}

function useSmoothPosition(positionMs: number, isPlaying: boolean) {
  const [displayMs, setDisplayMs] = useState(positionMs);

  // Base (backend-driven) timeline
  const baseRef = useRef({ baseMs: positionMs, baseAt: performance.now(), playing: isPlaying });

  // Optimistic timeline used right after a UI seek/drag release, until backend catches up
  const optimisticRef = useRef<null | { ms: number; at: number; until: number }>(null);

  const setOptimisticBase = (ms: number, windowMs = 600) => {
    const now = performance.now();
    // Also update base so the UI immediately reflects the new position
    baseRef.current = { baseMs: ms, baseAt: now, playing: baseRef.current.playing };
    optimisticRef.current = { ms, at: now, until: now + windowMs };
    setDisplayMs(ms);
  };

  // When backend updates, refresh base unless we're currently in an optimistic window.
  useEffect(() => {
    const now = performance.now();
    const opt = optimisticRef.current;

    // If backend has caught up (close enough), clear optimistic override
    if (opt && Math.abs(positionMs - opt.ms) <= 250) {
      optimisticRef.current = null;
    }

    // If no optimistic override is active, accept backend as the new base
    if (!optimisticRef.current) {
      baseRef.current = { baseMs: positionMs, baseAt: now, playing: isPlaying };
      setDisplayMs(positionMs);
      return;
    }

    // If we *are* optimistic, still keep playing state in sync
    baseRef.current.playing = isPlaying;
  }, [positionMs, isPlaying]);

  useEffect(() => {
    let raf = 0;

    const tick = () => {
      const now = performance.now();
      const opt = optimisticRef.current;

      // During the optimistic window, compute from optimistic base for smoothness
      if (opt && now < opt.until) {
        const next = baseRef.current.playing ? opt.ms + (now - opt.at) : opt.ms;
        setDisplayMs(next);
      } else {
        // Expire optimistic override if time window ended
        if (opt && now >= opt.until) {
          optimisticRef.current = null;
        }

        const { baseMs, baseAt, playing } = baseRef.current;
        const next = playing ? baseMs + (now - baseAt) : baseMs;
        setDisplayMs(next);
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return { displayMs, setOptimisticBase };
}

// simple throttle helper (time-based)
function makeThrottle(ms: number) {
  let last = 0;
  let queued: null | (() => void) = null;

  const run = (fn: () => void) => {
    const now = performance.now();
    if (now - last >= ms) {
      last = now;
      fn();
      return;
    }
    queued = fn;
    // schedule one trailing call
    window.setTimeout(() => {
      if (!queued) return;
      const q = queued;
      queued = null;
      last = performance.now();
      q();
    }, ms - (now - last));
  };

  return run;
}

export const CanvasWaveform: React.FC<CanvasWaveformProps> = ({
  peaks,
  durationMs,
  positionMs,
  isPlaying,
  onSeek,
  height = 28,
  className,
  dragSeekMode = "release",
  dragSeekHz = 12,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const { displayMs: smoothMs, setOptimisticBase } = useSmoothPosition(positionMs, isPlaying);

  // drag state
  const [isDragging, setIsDragging] = useState(false);
  const [dragMs, setDragMs] = useState<number | null>(null);

  const displayMs = useMemo(() => {
    // during drag, show the dragged position immediately
    if (dragMs != null) return dragMs;
    return smoothMs;
  }, [dragMs, smoothMs]);

  const progress = useMemo(() => {
    if (!durationMs || durationMs <= 0) return 0;
    return clamp01(displayMs / durationMs);
  }, [displayMs, durationMs]);

  const throttledSeek = useMemo(() => {
    const ms = Math.max(1, Math.floor(1000 / Math.max(1, dragSeekHz)));
    return makeThrottle(ms);
  }, [dragSeekHz]);

  const pxToMs = (clientX: number) => {
    const wrap = wrapRef.current;
    if (!wrap || !durationMs) return 0;
    const rect = wrap.getBoundingClientRect();
    const x = clientX - rect.left;
    const ratio = clamp01(x / rect.width);
    return Math.round(ratio * durationMs);
  };

  // draw waveform
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

    const ctx = canvas.getContext("2d", { alpha: true }); // Transparent background
    if (!ctx) return;

    // Enable smoothing for cleaner, sleeker bars
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Clear with transparent background (no black shadow)
    ctx.clearRect(0, 0, cssWidth, cssHeight);

    // Waveform colours - calm, smooth, less intense
    const unplayed = "rgba(180, 180, 190, 0.25)"; // soft gray for unplayed bars

    const n = peaks?.length ?? 0;
    if (n <= 0 || cssWidth <= 0) {
      ctx.fillStyle = unplayed;
      ctx.fillRect(0, cssHeight - 1, cssWidth, 1);
      return;
    }

    // OneTagger-like style: bottom-up bars (cleaner, more “DJ app”)
    const barCount = n;
    const barW = cssWidth / barCount;

    const gap = 1.2; // Increased gap between bars for cleaner, more defined separation
    const cornerRadius = 1.5; // Rounded tops for sleeker look
    
    // Optimized: batch similar bars together, skip gradients for performance
    const drawBars = (isPlayed: boolean) => {
      // Group bars by color for batch drawing
      ctx.beginPath();
      
      for (let i = 0; i < barCount; i++) {
        const rawAmp = clamp01(peaks[i] || 0);
        // Simplified: use raw amplitude directly (smoothing was expensive)
        const amp = rawAmp;

        const barH = Math.max(2, amp * cssHeight);
        const x = i * barW + gap / 2;
        const w = Math.max(0.5, barW - gap);
        const y = cssHeight - barH;

        // Simple rounded rect path (no gradient for performance)
        const radius = Math.min(cornerRadius, w / 2, barH / 2);
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + w - radius, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
        ctx.lineTo(x + w, y + barH);
        ctx.lineTo(x, y + barH);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
      }
      
      // Single fill for all bars of the same type
      ctx.fillStyle = isPlayed 
        ? 'rgba(107, 143, 163, 0.75)' 
        : 'rgba(180, 180, 190, 0.24)';
      ctx.fill();
    };

    // base layer (unplayed)
    drawBars(false);

    // played layer clip
    const playedPx = cssWidth * progress;
    if (playedPx > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, playedPx, cssHeight);
      ctx.clip();
      drawBars(true);
      ctx.restore();
    }
  }, [peaks, progress, height]);

  // pointer handlers (drag scrubbing)
  const onPointerDown = (e: React.PointerEvent) => {
    if (!durationMs) return;
    e.preventDefault();
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);

    const ms = pxToMs(e.clientX);
    setIsDragging(true);
    setDragMs(ms);

    // Pin the UI immediately to the down position for smooth feel
    setOptimisticBase(ms, 800);

    // optional: seek immediately on down
    if (dragSeekMode === "throttle") {
      onSeek(ms);
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !durationMs) return;
    e.preventDefault();

    const ms = pxToMs(e.clientX);
    setDragMs(ms);

    if (dragSeekMode === "throttle") {
      throttledSeek(() => onSeek(ms));
    }
  };

  const endDrag = (e: React.PointerEvent) => {
    if (!isDragging) return;
    e.preventDefault();

    const ms = pxToMs(e.clientX);

    setIsDragging(false);

    // Keep the playhead pinned to the released position until backend catches up
    setOptimisticBase(ms, 800);

    // Clear drag override after we set the optimistic base
    setDragMs(null);

    // commit seek at release (recommended default)
    onSeek(ms);
  };

  return (
    <div
      ref={wrapRef}
      className={className}
      style={{
        position: "relative",
        width: "100%",
        height,
        cursor: "pointer",
        userSelect: "none",
        touchAction: "none",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerLeave={(e) => {
        // If pointer is captured, leave won't fire often. But safe.
        if (isDragging) endDrag(e);
      }}
    >
      <canvas ref={canvasRef} className="quicktag-wave" />
      <div
        className="quicktag-playhead"
        style={{
          left: `${progress * 100}%`,
        }}
      />
    </div>
  );
};