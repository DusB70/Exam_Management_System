'use client';

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import {
  ToastItemData,
  ToastOptions,
  ToastType,
  ConfirmOptions,
  ToastMethods,
} from './toast.types';
import { ToastContainer } from './toast-container';
import { ConfirmModal } from './confirm-modal';

interface NotificationContextValue {
  toast: ToastMethods;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

// Standalone global dispatchers for use outside React components (e.g., in axios interceptors)
type ToastListener = (toast: ToastItemData) => void;
type DismissListener = (id: string) => void;
type DismissAllListener = () => void;
type ConfirmHandler = (options: ConfirmOptions) => Promise<boolean>;

let globalToastListener: ToastListener | null = null;
let globalDismissListener: DismissListener | null = null;
let globalDismissAllListener: DismissAllListener | null = null;
let globalConfirmHandler: ConfirmHandler | null = null;

const createToastData = (
  type: ToastType,
  message: string,
  options?: ToastOptions,
): ToastItemData => {
  return {
    id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    type,
    title: options?.title,
    message,
    duration: options?.duration !== undefined ? options.duration : 4500,
    createdAt: Date.now(),
  };
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItemData[]>([]);

  // Confirm state
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    options: ConfirmOptions | null;
    resolve: ((value: boolean) => void) | null;
  }>({
    isOpen: false,
    options: null,
    resolve: null,
  });

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const dismissAllToasts = useCallback(() => {
    setToasts([]);
  }, []);

  const addToast = useCallback((toastData: ToastItemData) => {
    setToasts((prev) => {
      // Keep maximum 5 toasts at a time to prevent screen flooding
      const updated = [toastData, ...prev];
      return updated.slice(0, 5);
    });
    return toastData.id;
  }, []);

  // Connect global listeners
  useEffect(() => {
    globalToastListener = (t) => addToast(t);
    globalDismissListener = (id) => dismissToast(id);
    globalDismissAllListener = () => dismissAllToasts();

    return () => {
      globalToastListener = null;
      globalDismissListener = null;
      globalDismissAllListener = null;
    };
  }, [addToast, dismissToast, dismissAllToasts]);

  // Construct toast methods
  const toastMethods = useRef<ToastMethods>(
    Object.assign(
      (message: string, options?: ToastOptions) => {
        const item = createToastData('info', message, options);
        return addToast(item);
      },
      {
        success: (message: string, options?: ToastOptions) => {
          const item = createToastData('success', message, options);
          return addToast(item);
        },
        error: (message: string, options?: ToastOptions) => {
          const item = createToastData('error', message, options);
          return addToast(item);
        },
        warning: (message: string, options?: ToastOptions) => {
          const item = createToastData('warning', message, options);
          return addToast(item);
        },
        info: (message: string, options?: ToastOptions) => {
          const item = createToastData('info', message, options);
          return addToast(item);
        },
        dismiss: (id: string) => {
          dismissToast(id);
        },
        dismissAll: () => {
          dismissAllToasts();
        },
      },
    ),
  );

  // Keep references fresh
  toastMethods.current = Object.assign(
    (message: string, options?: ToastOptions) => {
      const item = createToastData('info', message, options);
      return addToast(item);
    },
    {
      success: (message: string, options?: ToastOptions) => {
        const item = createToastData('success', message, options);
        return addToast(item);
      },
      error: (message: string, options?: ToastOptions) => {
        const item = createToastData('error', message, options);
        return addToast(item);
      },
      warning: (message: string, options?: ToastOptions) => {
        const item = createToastData('warning', message, options);
        return addToast(item);
      },
      info: (message: string, options?: ToastOptions) => {
        const item = createToastData('info', message, options);
        return addToast(item);
      },
      dismiss: (id: string) => {
        dismissToast(id);
      },
      dismissAll: () => {
        dismissAllToasts();
      },
    },
  );

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({
        isOpen: true,
        options,
        resolve,
      });
    });
  }, []);

  useEffect(() => {
    globalConfirmHandler = confirm;
    return () => {
      globalConfirmHandler = null;
    };
  }, [confirm]);

  const handleModalConfirm = () => {
    if (confirmState.resolve) {
      confirmState.resolve(true);
    }
    setConfirmState({ isOpen: false, options: null, resolve: null });
  };

  const handleModalCancel = () => {
    if (confirmState.resolve) {
      confirmState.resolve(false);
    }
    setConfirmState({ isOpen: false, options: null, resolve: null });
  };

  return (
    <NotificationContext.Provider
      value={{
        toast: toastMethods.current,
        confirm,
      }}
    >
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <ConfirmModal
        isOpen={confirmState.isOpen}
        options={confirmState.options}
        onConfirm={handleModalConfirm}
        onCancel={handleModalCancel}
      />
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

export const useToast = () => {
  const { toast } = useNotification();
  return toast;
};

export const useConfirm = () => {
  const { confirm } = useNotification();
  return confirm;
};

// Standalone global exports
export const toast: ToastMethods = Object.assign(
  (message: string, options?: ToastOptions) => {
    const item = createToastData('info', message, options);
    if (globalToastListener) {
      globalToastListener(item);
      return item.id;
    }
    console.warn('Toast called before NotificationProvider was mounted:', message);
    return item.id;
  },
  {
    success: (message: string, options?: ToastOptions) => {
      const item = createToastData('success', message, options);
      if (globalToastListener) {
        globalToastListener(item);
        return item.id;
      }
      return item.id;
    },
    error: (message: string, options?: ToastOptions) => {
      const item = createToastData('error', message, options);
      if (globalToastListener) {
        globalToastListener(item);
        return item.id;
      }
      return item.id;
    },
    warning: (message: string, options?: ToastOptions) => {
      const item = createToastData('warning', message, options);
      if (globalToastListener) {
        globalToastListener(item);
        return item.id;
      }
      return item.id;
    },
    info: (message: string, options?: ToastOptions) => {
      const item = createToastData('info', message, options);
      if (globalToastListener) {
        globalToastListener(item);
        return item.id;
      }
      return item.id;
    },
    dismiss: (id: string) => {
      if (globalDismissListener) globalDismissListener(id);
    },
    dismissAll: () => {
      if (globalDismissAllListener) globalDismissAllListener();
    },
  },
);

export const confirmDialog = (options: ConfirmOptions): Promise<boolean> => {
  if (globalConfirmHandler) {
    return globalConfirmHandler(options);
  }
  console.warn('confirmDialog called before NotificationProvider was mounted.');
  return Promise.resolve(
    window.confirm(typeof options.message === 'string' ? options.message : 'Are you sure?'),
  );
};
