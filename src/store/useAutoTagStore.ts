import { create } from 'zustand';
import {
  ProviderId,
  ProviderConfig,
  TagKey,
  AdvancedOptions,
  AutoTagEvent,
  AutoTagResult,
  RunState,
  WizardStep,
  DEFAULT_PROVIDERS,
  DEFAULT_TAGS,
  DEFAULT_ADVANCED_OPTIONS,
  INITIAL_RUN_STATE,
} from '../types/autotag';

// ============================================================================
// Store Interface
// ============================================================================

interface AutoTagState {
  // Modal visibility
  isOpen: boolean;
  openModal: (files?: string[]) => void;
  closeModal: () => void;
  
  // Wizard navigation
  step: WizardStep;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (step: WizardStep) => void;
  
  // Selected files (paths)
  selectedFiles: string[];
  setSelectedFiles: (files: string[]) => void;
  addFiles: (files: string[]) => void;
  removeFile: (path: string) => void;
  clearFiles: () => void;
  
  // Providers
  providers: ProviderConfig[];
  toggleProvider: (id: ProviderId) => void;
  reorderProviders: (fromIndex: number, toIndex: number) => void;
  setProviderAuth: (id: ProviderId, authState: ProviderConfig['authState']) => void;
  getEnabledProviders: () => ProviderId[];
  
  // Tags
  selectedTags: TagKey[];
  toggleTag: (tag: TagKey) => void;
  enableAllTags: () => void;
  disableAllTags: () => void;
  toggleAllTags: () => void;
  setSelectedTags: (tags: TagKey[]) => void;
  
  // Advanced options
  advanced: AdvancedOptions;
  setAdvancedOption: <K extends keyof AdvancedOptions>(key: K, value: AdvancedOptions[K]) => void;
  resetAdvancedOptions: () => void;
  
  // Run state
  run: RunState;
  startRun: () => void;
  pauseRun: () => void;
  resumeRun: () => void;
  cancelRun: () => void;
  ingestEvent: (event: AutoTagEvent) => void;
  setResults: (results: AutoTagResult[]) => void;
  clearRun: () => void;
  
  // Reset
  reset: () => void;
}

// ============================================================================
// All possible tags for toggle all
// ============================================================================

const ALL_TAG_KEYS: TagKey[] = [
  'artist', 'title', 'album', 'albumArtist', 'version', 'remixers',
  'genre', 'style', 'label', 'mood',
  'releaseId', 'trackId', 'catalogNumber', 'isrc', 'url',
  'bpm', 'key',
  'trackNumber', 'discNumber', 'trackTotal',
  'publishDate', 'releaseDate', 'year',
  'lyricsUnsynced', 'lyricsSynced',
  'albumArt', 'duration', 'explicit', 'otherTags',
];

// ============================================================================
// Store Implementation
// ============================================================================

export const useAutoTagStore = create<AutoTagState>((set, get) => ({
  // Modal visibility
  isOpen: false,
  openModal: (files?: string[]) => {
    set({
      isOpen: true,
      step: 0,
      selectedFiles: files || [],
      run: { ...INITIAL_RUN_STATE },
    });
  },
  closeModal: () => {
    const { run } = get();
    // Don't close if currently running
    if (run.status === 'running') {
      return;
    }
    set({ isOpen: false });
  },
  
  // Wizard navigation
  step: 0,
  nextStep: () => {
    const { step, run } = get();
    // Can only proceed past Run step if done
    if (step === 3 && run.status !== 'done' && run.status !== 'error') {
      return;
    }
    if (step < 4) {
      set({ step: (step + 1) as WizardStep });
    }
  },
  prevStep: () => {
    const { step, run } = get();
    // Can't go back while running
    if (run.status === 'running') {
      return;
    }
    if (step > 0) {
      set({ step: (step - 1) as WizardStep });
    }
  },
  goToStep: (newStep: WizardStep) => {
    const { run, step } = get();
    // Can't navigate while running
    if (run.status === 'running') {
      return;
    }
    // Can only go to Review if we have results
    if (newStep === 4 && run.results.length === 0) {
      return;
    }
    // Can't skip ahead past current + 1 unless we're going back
    if (newStep > step + 1 && newStep > step) {
      return;
    }
    set({ step: newStep });
  },
  
  // Selected files
  selectedFiles: [],
  setSelectedFiles: (files) => set({ selectedFiles: files }),
  addFiles: (files) => {
    const { selectedFiles } = get();
    const uniqueFiles = [...new Set([...selectedFiles, ...files])];
    set({ selectedFiles: uniqueFiles });
  },
  removeFile: (path) => {
    const { selectedFiles } = get();
    set({ selectedFiles: selectedFiles.filter((f) => f !== path) });
  },
  clearFiles: () => set({ selectedFiles: [] }),
  
  // Providers
  providers: [...DEFAULT_PROVIDERS],
  toggleProvider: (id) => {
    const { providers } = get();
    set({
      providers: providers.map((p) =>
        p.id === id ? { ...p, enabled: !p.enabled } : p
      ),
    });
  },
  reorderProviders: (fromIndex, toIndex) => {
    const { providers } = get();
    const newProviders = [...providers];
    const [removed] = newProviders.splice(fromIndex, 1);
    newProviders.splice(toIndex, 0, removed);
    // Update priority based on new order
    set({
      providers: newProviders.map((p, i) => ({ ...p, priority: i + 1 })),
    });
  },
  setProviderAuth: (id, authState) => {
    const { providers } = get();
    set({
      providers: providers.map((p) =>
        p.id === id ? { ...p, authState } : p
      ),
    });
  },
  getEnabledProviders: () => {
    const { providers } = get();
    return providers
      .filter((p) => p.enabled)
      .sort((a, b) => a.priority - b.priority)
      .map((p) => p.id);
  },
  
  // Tags
  selectedTags: [...DEFAULT_TAGS],
  toggleTag: (tag) => {
    const { selectedTags } = get();
    if (selectedTags.includes(tag)) {
      set({ selectedTags: selectedTags.filter((t) => t !== tag) });
    } else {
      set({ selectedTags: [...selectedTags, tag] });
    }
  },
  enableAllTags: () => set({ selectedTags: [...ALL_TAG_KEYS] }),
  disableAllTags: () => set({ selectedTags: [] }),
  toggleAllTags: () => {
    const { selectedTags } = get();
    if (selectedTags.length === ALL_TAG_KEYS.length) {
      set({ selectedTags: [] });
    } else {
      set({ selectedTags: [...ALL_TAG_KEYS] });
    }
  },
  setSelectedTags: (tags) => set({ selectedTags: tags }),
  
  // Advanced options
  advanced: { ...DEFAULT_ADVANCED_OPTIONS },
  setAdvancedOption: (key, value) => {
    const { advanced } = get();
    set({ advanced: { ...advanced, [key]: value } });
  },
  resetAdvancedOptions: () => set({ advanced: { ...DEFAULT_ADVANCED_OPTIONS } }),
  
  // Run state
  run: { ...INITIAL_RUN_STATE },
  startRun: () => {
    const runId = `run-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    set({
      run: {
        ...INITIAL_RUN_STATE,
        status: 'running',
        runId,
      },
      step: 3, // Go to Run step
    });
  },
  pauseRun: () => {
    const { run } = get();
    if (run.status === 'running') {
      set({ run: { ...run, status: 'paused' } });
    }
  },
  resumeRun: () => {
    const { run } = get();
    if (run.status === 'paused') {
      set({ run: { ...run, status: 'running' } });
    }
  },
  cancelRun: () => {
    const { run } = get();
    set({
      run: {
        ...run,
        status: 'idle',
      },
    });
  },
  ingestEvent: (event) => {
    const { run } = get();
    
    // Ignore events from different runs
    if (event.runId !== run.runId) {
      return;
    }
    
    const newRun = { ...run };
    newRun.events = [...run.events, event];
    
    // Update state based on event type
    switch (event.type) {
      case 'progress':
        if (event.current !== undefined && event.total !== undefined) {
          newRun.progress = {
            ...newRun.progress,
            current: event.current,
            total: event.total,
          };
        }
        break;
        
      case 'track_start':
      case 'track_searching':
        if (event.track) {
          newRun.currentTrack = event.track;
        }
        if (event.provider) {
          newRun.currentProvider = event.provider;
        }
        break;
        
      case 'track_complete':
        newRun.progress.success++;
        newRun.currentTrack = undefined;
        newRun.currentProvider = undefined;
        break;
        
      case 'track_skipped':
        newRun.progress.skipped++;
        newRun.currentTrack = undefined;
        newRun.currentProvider = undefined;
        break;
        
      case 'track_failed':
        newRun.progress.failed++;
        newRun.currentTrack = undefined;
        newRun.currentProvider = undefined;
        break;
        
      case 'paused':
        newRun.status = 'paused';
        break;
        
      case 'resumed':
        newRun.status = 'running';
        break;
        
      case 'cancelled':
        newRun.status = 'idle';
        break;
        
      case 'completed':
        newRun.status = 'done';
        newRun.currentTrack = undefined;
        newRun.currentProvider = undefined;
        break;
        
      case 'error':
        newRun.status = 'error';
        break;
    }
    
    set({ run: newRun });
  },
  setResults: (results) => {
    const { run } = get();
    set({ run: { ...run, results } });
  },
  clearRun: () => set({ run: { ...INITIAL_RUN_STATE } }),
  
  // Reset
  reset: () => {
    set({
      isOpen: false,
      step: 0,
      selectedFiles: [],
      providers: [...DEFAULT_PROVIDERS],
      selectedTags: [...DEFAULT_TAGS],
      advanced: { ...DEFAULT_ADVANCED_OPTIONS },
      run: { ...INITIAL_RUN_STATE },
    });
  },
}));
