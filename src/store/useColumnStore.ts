import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type FontSize = 'small' | 'medium' | 'large';
export type TableDensity = 'compact' | 'comfortable';

export interface ColumnConfig {
  id: string;
  label: string;
  width: string; // e.g., '45px', '2fr'
  visible: boolean;
  resizable: boolean;
  minWidth?: number; // in px
  maxWidth?: number; // in px
}

export interface ColumnState {
  columns: ColumnConfig[];
  columnOrder: string[]; // Array of column IDs in display order
  fontSize: FontSize;
  density: TableDensity;

  // Actions
  setColumnWidth: (columnId: string, width: string) => void;
  setColumnOrder: (order: string[]) => void;
  setColumnVisibility: (columnId: string, visible: boolean) => void;
  setFontSize: (size: FontSize) => void;
  cycleFontSize: () => void;
  cycleDensity: () => void;
  resetColumns: () => void;
}

// Default column configuration
export const DEFAULT_COLUMNS: ColumnConfig[] = [
  { id: 'checkbox', label: '', width: '38px', visible: true, resizable: false },
  { id: 'art', label: 'Art', width: '56px', visible: true, resizable: true, minWidth: 44, maxWidth: 120 },
  { id: 'title', label: 'Title', width: '2.2fr', visible: true, resizable: true, minWidth: 120 },
  { id: 'artist', label: 'Artist', width: '1.6fr', visible: true, resizable: true, minWidth: 120 },
  { id: 'album', label: 'Album', width: '1.4fr', visible: true, resizable: true, minWidth: 120 },
  { id: 'genre', label: 'Genre', width: '1.1fr', visible: true, resizable: true, minWidth: 90 },
  { id: 'rating', label: 'Rating', width: '110px', visible: true, resizable: true, minWidth: 90, maxWidth: 160 },
  { id: 'bpm', label: 'BPM', width: '70px', visible: true, resizable: true, minWidth: 60 },
  { id: 'key', label: 'Key', width: '70px', visible: true, resizable: true, minWidth: 60 },
  { id: 'waveform', label: 'Waveform', width: '150px', visible: false, resizable: true, minWidth: 100 },
  { id: 'tags', label: 'Tags', width: '1fr', visible: false, resizable: true, minWidth: 120 },
  { id: 'time', label: 'Time', width: '70px', visible: false, resizable: true, minWidth: 60 },
  { id: 'year', label: 'Year', width: '70px', visible: false, resizable: true, minWidth: 60 },
];

const DEFAULT_COLUMN_ORDER = DEFAULT_COLUMNS.map(c => c.id);
const DEFAULT_FONT_SIZE: FontSize = 'medium';
const DEFAULT_DENSITY: TableDensity = 'compact';

export const useColumnStore = create<ColumnState>()(
  persist(
    (set, get) => ({
      columns: DEFAULT_COLUMNS,
      columnOrder: DEFAULT_COLUMN_ORDER,
      fontSize: DEFAULT_FONT_SIZE,
      density: DEFAULT_DENSITY,
      
      setColumnWidth: (columnId: string, width: string) => {
        set(state => ({
          columns: state.columns.map(col =>
            col.id === columnId ? { ...col, width } : col
          ),
        }));
      },
      
      setColumnOrder: (order: string[]) => {
        set({ columnOrder: order });
      },
      
      setColumnVisibility: (columnId: string, visible: boolean) => {
        const { columns } = get();
        
        // Count currently visible columns
        const visibleCount = columns.filter(c => c.visible).length;
        
        // Prevent hiding the last visible column
        if (!visible && visibleCount <= 1) {
          console.warn('Cannot hide the last visible column');
          return;
        }
        
        set(state => ({
          columns: state.columns.map(col =>
            col.id === columnId ? { ...col, visible } : col
          ),
        }));
      },
      
      setFontSize: (size: FontSize) => {
        set({ fontSize: size });
      },
      
      cycleFontSize: () => {
        const { fontSize } = get();
        const sizes: FontSize[] = ['small', 'medium', 'large'];
        const currentIndex = sizes.indexOf(fontSize);
        const nextIndex = (currentIndex + 1) % sizes.length;
        set({ fontSize: sizes[nextIndex] });
      },

      cycleDensity: () => {
        const { density } = get();
        const densities: TableDensity[] = ['compact', 'comfortable'];
        const currentIndex = densities.indexOf(density);
        const nextIndex = (currentIndex + 1) % densities.length;
        set({ density: densities[nextIndex] });
      },
      
      resetColumns: () => {
        set({
          columns: DEFAULT_COLUMNS,
          columnOrder: DEFAULT_COLUMN_ORDER,
          fontSize: DEFAULT_FONT_SIZE,
          density: DEFAULT_DENSITY,
        });
      },
    }),
    {
      name: 'bonk-column-config', // localStorage key
      version: 4,
      migrate: (persisted: any, version: number) => {
        if (!persisted || typeof persisted !== 'object') return persisted;

        // v4 adds the Waveform column.
        if (version < 4) {
          const waveformCol: ColumnConfig = {
            id: 'waveform',
            label: 'Waveform',
            width: '150px',
            visible: false,
            resizable: true,
            minWidth: 100,
          };

          const columns: ColumnConfig[] = Array.isArray(persisted.columns) ? persisted.columns : [];
          const hasWaveform = columns.some((c) => c?.id === 'waveform');
          if (!hasWaveform) {
            persisted.columns = [...columns, waveformCol];
          }

          const columnOrder: string[] = Array.isArray(persisted.columnOrder) ? persisted.columnOrder : [];
          const hasInOrder = columnOrder.includes('waveform');
          if (!hasInOrder) {
            persisted.columnOrder = [...columnOrder, 'waveform'];
          }
        }

        // v3 adds density. Preserve user config and default to compact.
        if (version < 3) {
          persisted.density = (persisted as any).density ?? DEFAULT_DENSITY;
        }

        // v2 adds the Rating column.
        if (version < 2) {
          const ratingCol: ColumnConfig = {
            id: 'rating',
            label: 'Rating',
            width: '110px',
            visible: true,
            resizable: true,
            minWidth: 90,
            maxWidth: 160,
          };

          const columns: ColumnConfig[] = Array.isArray(persisted.columns) ? persisted.columns : [];
          const hasRating = columns.some((c) => c?.id === 'rating');
          const nextColumns = hasRating ? columns : [...columns, ratingCol];

          const columnOrder: string[] = Array.isArray(persisted.columnOrder) ? persisted.columnOrder : [];
          const hasInOrder = columnOrder.includes('rating');
          let nextOrder = columnOrder;
          if (!hasInOrder) {
            const genreIdx = columnOrder.indexOf('genre');
            if (genreIdx >= 0) {
              nextOrder = [...columnOrder.slice(0, genreIdx + 1), 'rating', ...columnOrder.slice(genreIdx + 1)];
            } else {
              nextOrder = [...columnOrder, 'rating'];
            }
          }
          persisted.columns = nextColumns;
          persisted.columnOrder = nextOrder;
        }

        return persisted;
      },
    }
  )
);
