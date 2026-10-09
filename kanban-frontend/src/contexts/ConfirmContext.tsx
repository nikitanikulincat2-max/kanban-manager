import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'primary' | 'warning';
}

interface ConfirmState extends ConfirmOptions {
  isOpen: boolean;
  resolve: ((value: boolean) => void) | null;
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

export const ConfirmProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<ConfirmState>({
    isOpen: false,
    message: '',
    resolve: null,
  });

  const confirm = (options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({ ...options, isOpen: true, resolve });
    });
  };

  const handleConfirm = () => {
    state.resolve?.(true);
    setState({ ...state, isOpen: false });
  };

  const handleCancel = () => {
    state.resolve?.(false);
    setState({ ...state, isOpen: false });
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}

      {state.isOpen && (
        <div className="kb-modal-backdrop" onClick={handleCancel}>
          <div
            className="kb-modal-content"
            style={{ maxWidth: 440 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="kb-modal-header">
              <h5 className="kb-modal-title">
                {state.title || 'Подтверждение'}
              </h5>
              <button
                type="button"
                className="btn-close"
                onClick={handleCancel}
              ></button>
            </div>

            <div className="kb-modal-body">
              <p className="mb-0" style={{ whiteSpace: 'pre-line' }}>
                {state.message}
              </p>
            </div>

            <div className="kb-modal-footer">
              <button className="btn btn-secondary" onClick={handleCancel}>
                {state.cancelText || 'Отмена'}
              </button>
              <button
                className={`btn btn-${
                  state.variant === 'danger'
                    ? 'danger'
                    : state.variant === 'warning'
                    ? 'warning'
                    : 'primary'
                }`}
                onClick={handleConfirm}
              >
                {state.confirmText || 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
};

export const useConfirm = () => {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx;
};