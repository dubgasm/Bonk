import { Key } from '@tonaljs/tonal';

// Krumhansl-Schmuckler key profiles
const majorProfile = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const minorProfile = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

const keyNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export interface KeyDetectionResult {
  key: string;
  confidence: number;
  camelot: string;
}

// Convert key to Camelot notation
export function toCamelot(key: string): string {
  const camelotMap: { [key: string]: string } = {
    // Major keys
    'C': '8B', 'G': '9B', 'D': '10B', 'A': '11B', 'E': '12B', 'B': '1B',
    'F#': '2B', 'Gb': '2B', 'C#': '3B', 'Db': '3B', 'G#': '4B', 'Ab': '4B',
    'D#': '5B', 'Eb': '5B', 'A#': '6B', 'Bb': '6B', 'F': '7B',
    // Minor keys
    'Am': '8A', 'Em': '9A', 'Bm': '10A', 'F#m': '11A', 'Gbm': '11A',
    'C#m': '12A', 'Dbm': '12A', 'G#m': '1A', 'Abm': '1A', 'D#m': '2A',
    'Ebm': '2A', 'A#m': '3A', 'Bbm': '3A', 'Fm': '4A', 'Cm': '5A',
    'Gm': '6A', 'Dm': '7A',
  };
  
  return camelotMap[key] || key;
}

// Correlation coefficient calculation
function correlate(x: number[], y: number[]): number {
  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
  const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);
  
  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  
  return denominator === 0 ? 0 : numerator / denominator;
}

// Rotate array
function rotate(arr: number[], n: number): number[] {
  return [...arr.slice(n), ...arr.slice(0, n)];
}

// Simple key detection using chroma features
export function detectKeyFromChroma(chromagram: number[][]): KeyDetectionResult {
  // Average chromagram over time
  const avgChroma = new Array(12).fill(0);
  for (let i = 0; i < chromagram.length; i++) {
    for (let j = 0; j < 12; j++) {
      avgChroma[j] += chromagram[i][j];
    }
  }
  avgChroma.forEach((_, i) => avgChroma[i] /= chromagram.length);
  
  // Test all keys
  let bestKey = 'C';
  let bestConfidence = -1;
  
  for (let i = 0; i < 12; i++) {
    const rotatedChroma = rotate(avgChroma, i);
    
    // Test major
    const majorCorr = correlate(rotatedChroma, majorProfile);
    if (majorCorr > bestConfidence) {
      bestConfidence = majorCorr;
      bestKey = keyNames[i];
    }
    
    // Test minor
    const minorCorr = correlate(rotatedChroma, minorProfile);
    if (minorCorr > bestConfidence) {
      bestConfidence = minorCorr;
      bestKey = keyNames[i] + 'm';
    }
  }
  
  const normalizedConfidence = Math.max(0, Math.min(1, (bestConfidence + 1) / 2));
  
  return {
    key: bestKey,
    confidence: normalizedConfidence,
    camelot: toCamelot(bestKey),
  };
}

// Simplified key detection for when we can't use full audio analysis
// Uses basic pitch class distribution
export function detectKeySimple(pitchClasses: number[]): KeyDetectionResult {
  if (!pitchClasses || pitchClasses.length !== 12) {
    return { key: 'Unknown', confidence: 0, camelot: '' };
  }
  
  let bestKey = 'C';
  let bestConfidence = -1;
  
  for (let i = 0; i < 12; i++) {
    const rotated = rotate(pitchClasses, i);
    
    const majorCorr = correlate(rotated, majorProfile);
    if (majorCorr > bestConfidence) {
      bestConfidence = majorCorr;
      bestKey = keyNames[i];
    }
    
    const minorCorr = correlate(rotated, minorProfile);
    if (minorCorr > bestConfidence) {
      bestConfidence = minorCorr;
      bestKey = keyNames[i] + 'm';
    }
  }
  
  return {
    key: bestKey,
    confidence: Math.max(0, Math.min(1, (bestConfidence + 1) / 2)),
    camelot: toCamelot(bestKey),
  };
}

// Convert key notation formats
export function normalizeKey(key: string): string {
  if (!key) return '';
  
  // Try to parse with Tonal
  try {
    const majorParsed = Key.majorKey(key);
    const minorParsed = Key.minorKey(key);
    const parsed = majorParsed || minorParsed;
    if (parsed && parsed.tonic) {
      const isMinor = minorParsed !== null;
      return parsed.tonic + (isMinor ? 'm' : '');
    }
  } catch (e) {
    // Fallback to manual parsing
  }
  
  return key;
}

