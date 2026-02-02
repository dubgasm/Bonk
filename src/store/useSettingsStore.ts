import { create } from 'zustand';
import { AppSettings, defaultSettings, SyncMode, ApiCredentials, KeyFormat } from '../types/settings';

interface SettingsState extends AppSettings {
  updateSyncMode: (mode: SyncMode) => void;
  toggleDontTouchMyGrids: () => void;
  toggleConvertColors: () => void;
  updateTagWriteSetting: (field: keyof AppSettings['tagWriteSettings'], value: boolean) => void;
  updateApiCredential: (field: keyof ApiCredentials, value: string) => void;
  updateKeyFormat: (format: KeyFormat) => void;
  setLastSyncDate: (date: string) => void;
  setSkipPlaylistRemovalConfirm: (skip: boolean) => void;
  resetSettings: () => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  ...defaultSettings,

  updateSyncMode: (mode) =>
    set((state) => ({
      syncSettings: { ...state.syncSettings, mode },
    })),

  toggleDontTouchMyGrids: () =>
    set((state) => ({
      syncSettings: {
        ...state.syncSettings,
        dontTouchMyGrids: !state.syncSettings.dontTouchMyGrids,
      },
    })),

  toggleConvertColors: () =>
    set((state) => ({
      syncSettings: {
        ...state.syncSettings,
        convertColors: !state.syncSettings.convertColors,
      },
    })),

  updateTagWriteSetting: (field, value) =>
    set((state) => ({
      tagWriteSettings: {
        ...state.tagWriteSettings,
        [field]: value,
      },
    })),

  updateApiCredential: (field, value) =>
    set((state) => ({
      apiCredentials: {
        ...state.apiCredentials,
        [field]: value,
      },
    })),

  updateKeyFormat: (format) =>
    set((state) => ({
      taggingPreferences: {
        ...state.taggingPreferences,
        keyFormat: format,
      },
    })),

  setLastSyncDate: (date) =>
    set({ lastSyncDate: date }),

  setSkipPlaylistRemovalConfirm: (skip) =>
    set({ skipPlaylistRemovalConfirm: skip }),

  resetSettings: () => set(defaultSettings),
}));

