/**
 * Performance Monitor - Lightweight timing and metrics for development
 * 
 * Provides utilities for measuring critical operations:
 * - Search response time
 * - Render timing
 * - Memory usage tracking
 */

// Only enable in development
const IS_DEV = process.env.NODE_ENV === 'development';

interface PerformanceEntry {
  name: string;
  duration: number;
  timestamp: number;
}

// Keep last N entries for each metric type
const HISTORY_SIZE = 50;
const metricsHistory: Map<string, PerformanceEntry[]> = new Map();

/**
 * Start a performance measurement
 */
export function startMeasure(name: string): () => number {
  if (!IS_DEV) return () => 0;
  
  const start = performance.now();
  
  return () => {
    const duration = performance.now() - start;
    recordMetric(name, duration);
    return duration;
  };
}

/**
 * Measure an async operation
 */
export async function measureAsync<T>(
  name: string,
  operation: () => Promise<T>
): Promise<T> {
  if (!IS_DEV) return operation();
  
  const start = performance.now();
  try {
    return await operation();
  } finally {
    const duration = performance.now() - start;
    recordMetric(name, duration);
  }
}

/**
 * Measure a sync operation
 */
export function measureSync<T>(name: string, operation: () => T): T {
  if (!IS_DEV) return operation();
  
  const start = performance.now();
  try {
    return operation();
  } finally {
    const duration = performance.now() - start;
    recordMetric(name, duration);
  }
}

/**
 * Record a metric entry
 */
function recordMetric(name: string, duration: number): void {
  if (!IS_DEV) return;
  
  const entry: PerformanceEntry = {
    name,
    duration,
    timestamp: Date.now(),
  };
  
  let history = metricsHistory.get(name);
  if (!history) {
    history = [];
    metricsHistory.set(name, history);
  }
  
  history.push(entry);
  
  // Trim to history size
  if (history.length > HISTORY_SIZE) {
    history.shift();
  }
  
  // Log slow operations (> 100ms)
  if (duration > 100) {
    console.warn(`[Perf] Slow operation: ${name} took ${duration.toFixed(2)}ms`);
  } else if (duration > 16) {
    // Over one frame budget
    console.log(`[Perf] ${name}: ${duration.toFixed(2)}ms`);
  }
}

/**
 * Get average duration for a metric
 */
export function getAverageDuration(name: string): number {
  const history = metricsHistory.get(name);
  if (!history || history.length === 0) return 0;
  
  const sum = history.reduce((acc, entry) => acc + entry.duration, 0);
  return sum / history.length;
}

/**
 * Get all metrics summaries
 */
export function getMetricsSummary(): Record<string, { avg: number; max: number; count: number }> {
  const summary: Record<string, { avg: number; max: number; count: number }> = {};
  
  metricsHistory.forEach((history, name) => {
    if (history.length === 0) return;
    
    const sum = history.reduce((acc, e) => acc + e.duration, 0);
    const max = Math.max(...history.map(e => e.duration));
    
    summary[name] = {
      avg: sum / history.length,
      max,
      count: history.length,
    };
  });
  
  return summary;
}

/**
 * Log current memory usage (Electron only)
 */
export function logMemoryUsage(): void {
  if (!IS_DEV) return;
  
  // Check if running in Electron with process memory info
  if (typeof process !== 'undefined' && process.memoryUsage) {
    const usage = process.memoryUsage();
    console.log('[Memory]', {
      heapUsed: `${(usage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
      heapTotal: `${(usage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
      external: `${(usage.external / 1024 / 1024).toFixed(2)} MB`,
    });
  }
  
  // Also log performance memory if available (Chrome)
  if ((performance as any).memory) {
    const memory = (performance as any).memory;
    console.log('[Browser Memory]', {
      usedJSHeapSize: `${(memory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
      totalJSHeapSize: `${(memory.totalJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
    });
  }
}

/**
 * Clear all metrics
 */
export function clearMetrics(): void {
  metricsHistory.clear();
}

// Export for debugging
if (IS_DEV && typeof window !== 'undefined') {
  (window as any).__perfMonitor = {
    getMetricsSummary,
    logMemoryUsage,
    clearMetrics,
    metricsHistory,
  };
}
