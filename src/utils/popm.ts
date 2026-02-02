/**
 * POPM (Popularimeter) byte conversion utilities
 * Maps 0-5 stars to ID3v2.3 POPM byte values (0-255)
 * Compatible with Rekordbox's rating system
 */

export function starsToPopmByte(stars: number | null): number {
  if (!stars || stars <= 0) return 0;
  if (stars >= 5) return 255;
  return Math.round(stars * 51); // 1..4 => 51..204
}

export function popmByteToStars(byte: number): number {
  if (byte >= 255) return 5;
  if (byte <= 0) return 0;
  return Math.max(0, Math.min(4, Math.round(byte / 51)));
}
