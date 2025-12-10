import { create } from 'zustand';
import { AppSettings, defaultSettings, SyncMode, ApiCredentials } from '../types/settings';

interface SettingsState extends AppSettings {
  updateSyncMode: (mode: SyncMode) => void;
  toggleDontTouchMyGrids: () => void;
  toggleConvertColors: () => void;
  updateTagWriteSetting: (field: keyof AppSettings['tagWriteSettings'], value: boolean) => void;
  updateApiCredential: (field: keyof ApiCredentials, value: string) => void;
  setLastSyncDate: (date: string) => void;
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

  setLastSyncDate: (date) =>
    set({ lastSyncDate: date }),

  resetSettings: () => set(defaultSettings),
}));

