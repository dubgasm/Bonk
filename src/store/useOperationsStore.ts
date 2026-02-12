import { create } from 'zustand';

export type OperationStatus = 'running' | 'success' | 'error' | 'cancelled';

export interface Operation {
  id: string;
  title: string;
  message?: string;
  // 0..100 for determinate, or null for unknown/indeterminate
  progress: number | null;
  status: OperationStatus;
  canCancel: boolean;
  startedAt: number;
  updatedAt: number;
}

interface OperationsState {
  operations: Record<string, Operation>;

  upsert: (op: Omit<Operation, 'updatedAt'> & { updatedAt?: number }) => void;
  finish: (id: string, status: Exclude<OperationStatus, 'running'>, message?: string) => void;
  remove: (id: string) => void;
}

export const useOperationsStore = create<OperationsState>((set, get) => ({
  operations: {},

  upsert: (op) => {
    const now = Date.now();
    set((state) => {
      const prev = state.operations[op.id];
      const startedAt = prev?.startedAt ?? op.startedAt ?? now;
      return {
        operations: {
          ...state.operations,
          [op.id]: {
            ...prev,
            ...op,
            startedAt,
            updatedAt: op.updatedAt ?? now,
          },
        },
      };
    });
  },

  finish: (id, status, message) => {
    const now = Date.now();
    const op = get().operations[id];
    if (!op) return;
    set((state) => ({
      operations: {
        ...state.operations,
        [id]: {
          ...op,
          status,
          canCancel: false,
          progress: op.progress ?? 100,
          message: message ?? op.message,
          updatedAt: now,
        },
      },
    }));
  },

  remove: (id) => {
    set((state) => {
      const next = { ...state.operations };
      delete next[id];
      return { operations: next };
    });
  },
}));

export const getActiveOperations = (ops: Record<string, Operation>) =>
  Object.values(ops).sort((a, b) => b.updatedAt - a.updatedAt);
