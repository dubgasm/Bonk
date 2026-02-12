import { useState } from 'react';
import './mood-pills.css';

export interface MoodCategory {
  label: string;
  moods: string[];
}

export const MOOD_CATEGORIES: MoodCategory[] = [
  {
    label: 'Energy',
    moods: ['Happy', 'Sad', 'Bright', 'Dark', 'Angry', 'Chill', 'Lovely', 'Powerful', 'Sexy', 'Rally'],
  },
  {
    label: 'Genre',
    moods: [
      '2-step',
      'Acid',
      'Breakbeat',
      'Disco',
      'Drum & Bass',
      'Electro',
      'Funk',
      'Hardcore',
      'Hiphop',
      'House',
      'Industrial',
      'Jungle',
      'Latin',
      'Minimal',
      'Nu-Disco',
      'Oldies',
      'Pop',
      'Reggae',
      'Rock',
      'Techno',
      'Trance',
    ],
  },
];

interface MoodPillTagsProps {
  selectedMoods: string[];
  onToggle: (mood: string) => void;
  variant?: 'compact' | 'full';
  disabled?: boolean;
}

export default function MoodPillTags({
  selectedMoods,
  onToggle,
  variant = 'full',
  disabled = false,
}: MoodPillTagsProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['Energy', 'Genre'])
  );

  const toggleCategory = (label: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(label)) {
      newExpanded.delete(label);
    } else {
      newExpanded.add(label);
    }
    setExpandedCategories(newExpanded);
  };

  return (
    <div className={`mood-pills-container ${variant === 'compact' ? 'mood-pills-compact' : ''}`}>
      {MOOD_CATEGORIES.map((category) => {
        const isExpanded = expandedCategories.has(category.label);
        
        return (
          <div key={category.label} className="mood-category">
            <div className="mood-category-header" onClick={() => toggleCategory(category.label)}>
              <h4 className="mood-category-label">{category.label}</h4>
              <span className="mood-category-toggle">{isExpanded ? '▾' : '▸'}</span>
            </div>
            
            {isExpanded && (
              <div className="mood-pills-row">
                {category.moods.map((mood) => (
                  <button
                    key={mood}
                    className={`mood-pill ${selectedMoods.includes(mood) ? 'mood-pill-active' : ''}`}
                    onClick={() => !disabled && onToggle(mood)}
                    disabled={disabled}
                    type="button"
                  >
                    {mood}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Helper function to parse mood string from Track.Mood field
export function parseMoodString(moodStr?: string): string[] {
  if (!moodStr) return [];
  return moodStr
    .split(',')
    .map((m) => m.trim())
    .filter((m) => m.length > 0);
}

// Helper function to serialize moods back to string
export function serializeMoods(moods: string[]): string {
  return moods.join(', ');
}
