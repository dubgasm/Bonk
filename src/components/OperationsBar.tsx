import { useMemo } from 'react';
import { AlertCircle, Ban, CheckCircle, Loader, X } from 'lucide-react';
import { getActiveOperations, Operation, useOperationsStore } from '../store/useOperationsStore';

interface OperationsBarProps {
  onCancel: (operationId: string) => void;
}

function getOperationIcon(op: Operation) {
  if (op.status === 'running') return <Loader size={14} className="spinning" />;
  if (op.status === 'success') return <CheckCircle size={14} />;
  if (op.status === 'cancelled') return <Ban size={14} />;
  return <AlertCircle size={14} />;
}

export default function OperationsBar({ onCancel }: OperationsBarProps) {
  const opsMap = useOperationsStore((s) => s.operations);
  const remove = useOperationsStore((s) => s.remove);

  const ops = useMemo(() => {
    const sorted = getActiveOperations(opsMap);
    // Keep this compact (avoid pushing the main UI down too far)
    return sorted
      .filter((op) => op.status === 'running' || op.status === 'error' || op.status === 'cancelled' || op.status === 'success')
      .slice(0, 2);
  }, [opsMap]);

  if (ops.length === 0) return null;

  return (
    <div className="operations-bar" role="region" aria-label="Operations">
      {ops.map((op) => {
        const pct = typeof op.progress === 'number' ? Math.max(0, Math.min(100, Math.round(op.progress))) : null;
        return (
          <div key={op.id} className={`operation-row operation-${op.status}`}>
            <div className="operation-left">
              <span className="operation-icon" aria-hidden="true">
                {getOperationIcon(op)}
              </span>
              <div className="operation-text">
                <div className="operation-title">{op.title}</div>
                {op.message && <div className="operation-message">{op.message}</div>}
              </div>
            </div>

            <div className="operation-right">
              {pct != null && (
                <div className="operation-progress" aria-label={`Progress ${pct}%`}>
                  <div className="operation-progress-bar">
                    <div className="operation-progress-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="operation-progress-label">{pct}%</div>
                </div>
              )}

              {op.status === 'running' && op.canCancel && (
                <button className="operation-btn" onClick={() => onCancel(op.id)}>
                  Cancel
                </button>
              )}

              <button
                className="operation-btn operation-dismiss"
                onClick={() => remove(op.id)}
                aria-label={`Dismiss ${op.title}`}
                title="Dismiss"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
