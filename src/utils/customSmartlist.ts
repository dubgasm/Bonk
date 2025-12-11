import { Track } from '../types/track';

export type TagSmartlistOperator = 'is' | 'is not' | 'contains' | 'in list';
export type TagSmartlistMatchMode = 'ALL' | 'ANY';

export interface TagSmartlistRule {
  field: 'tag';
  operator: TagSmartlistOperator;
  value: string | string[];
}

/**
 * Evaluate a set of tag-based smartlist rules against a track list.
 * Returns tracks that satisfy ALL rules (matchMode=ALL) or ANY rule (matchMode=ANY).
 */
export function evaluateTagSmartlist(
  tracks: Track[],
  rules: TagSmartlistRule[],
  matchMode: TagSmartlistMatchMode
): Track[] {
  if (!rules.length) return tracks;

  const normalizedRules = rules.map((rule) => ({
    ...rule,
    values: Array.isArray(rule.value)
      ? rule.value.map((v) => v.toLowerCase().trim()).filter(Boolean)
      : [String(rule.value).toLowerCase().trim()],
  }));

  const trackPassesRule = (track: Track, rule: TagSmartlistRule & { values: string[] }) => {
    const tagNames = (track.tags || []).map((t) => (t.name || '').toLowerCase().trim()).filter(Boolean);
    if (!tagNames.length && rule.operator !== 'is not') {
      return false;
    }

    switch (rule.operator) {
      case 'is':
        return rule.values.some((v) => tagNames.includes(v));
      case 'is not':
        return rule.values.every((v) => !tagNames.includes(v));
      case 'contains':
        return rule.values.some((v) => tagNames.some((tag) => tag.includes(v)));
      case 'in list':
        return rule.values.some((v) => tagNames.includes(v));
      default:
        return false;
    }
  };

  return tracks.filter((track) => {
    if (matchMode === 'ALL') {
      return normalizedRules.every((rule) => trackPassesRule(track, rule));
    }
    return normalizedRules.some((rule) => trackPassesRule(track, rule));
  });
}

