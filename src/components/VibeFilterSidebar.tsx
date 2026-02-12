import { useState } from 'react';
import './mood-pills.css';

export interface VibeCategory {
  name: string;
  icon: string;
  vibes: string[];
}

export const VIBE_CATEGORIES: VibeCategory[] = [
  {
    name: 'World',
    icon: '🌍',
    vibes: ['Afro', 'Asian', 'Arabic', 'Latin', 'Ethnic'],
  },
  {
    name: 'Style',
    icon: '🎨',
    vibes: ['Classic', 'Dirty', 'Funky', 'Glitchy', 'Melodic', 'Minimal', 'Nu-Disco'],
  },
  {
    name: 'Mood',
    icon: '😊',
    vibes: ['Soulful', 'Sensual', 'Hypnotic', 'Rally', 'Bait Barrel'],
  },
];

interface VibeFilterSidebarProps {
  activeFilters: Set<string>;
  onToggleFilter: (vibe: string) => void;
  onClose?: () => void;
}

export default function VibeFilterSidebar({
  activeFilters,
  onToggleFilter,
}: VibeFilterSidebarProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['World', 'Style', 'Mood'])
  );

  const toggleSection = (sectionName: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionName)) {
      newExpanded.delete(sectionName);
    } else {
      newExpanded.add(sectionName);
    }
    setExpandedSections(newExpanded);
  };

  const handleAddCustomNote = () => {
    // TODO: Implement custom note dialog
    console.log('Add custom note clicked');
  };

  return (
    <div className="vibe-filter-content">

      {VIBE_CATEGORIES.map((category) => {
        const isExpanded = expandedSections.has(category.name);

        return (
          <div key={category.name} className="vibe-filter-section">
            <div
              className="vibe-filter-section-header"
              onClick={() => toggleSection(category.name)}
            >
              <span className="vibe-filter-section-title">
                <span className="vibe-icon">{category.icon}</span>
                {category.name}
              </span>
              <span className="vibe-filter-section-toggle">{isExpanded ? '▾' : '▸'}</span>
            </div>

            {isExpanded && (
              <div className="vibe-filter-items">
                {category.vibes.map((vibe) => (
                  <label key={vibe} className="vibe-checkbox">
                    <input
                      type="checkbox"
                      checked={activeFilters.has(vibe)}
                      onChange={() => onToggleFilter(vibe)}
                    />
                    <span>{vibe}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        );
      })}

      <button className="add-custom-note" onClick={handleAddCustomNote}>
        + Add Custom Note
      </button>
    </div>
  );
}
