import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

export type ConfirmOptions = {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

type ConfirmState = {
  options: ConfirmOptions;
  resolve: (value: boolean) => void;
};

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConfirmState | null>(null);

  const confirm = useCallback<ConfirmFn>((options) => {
    return new Promise((resolve) => {
      setState({ options, resolve });
    });
  }, []);

  const close = useCallback((value: boolean) => {
    setState((prev) => {
      if (!prev) return null;
      prev.resolve(value);
      return null;
    });
  }, []);

  const ctx = useMemo(() => confirm, [confirm]);

  return (
    <ConfirmContext.Provider value={ctx}>
      {children}

      {state && (
        <div className="modal-overlay" onClick={() => close(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <AlertTriangle size={20} className="warning-icon" />
                <h2 style={{ fontSize: 16 }}>{state.options.title}</h2>
              </div>
            </div>

            <div className="modal-content" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              {state.options.message}
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => close(false)}>
                {state.options.cancelLabel || 'Cancel'}
              </button>
              <button
                className={`btn ${state.options.danger ? 'btn-danger' : 'btn-primary'}`}
                onClick={() => close(true)}
              >
                {state.options.confirmLabel || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return ctx;
}
