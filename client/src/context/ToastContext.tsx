import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { YStack, Text, Card } from 'tamagui';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

// Type definitions
interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration: number;
}

interface ToastContextValue {
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
}

interface ToastProviderProps {
  children: ReactNode;
}

// Create context with undefined as default (will throw error if used without provider)
const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: Toast['type'], duration: number = 3000): void => {
    const id: string = `${Date.now()}-${Math.random()}`;
    const newToast: Toast = { id, message, type, duration };

    setToasts((prev: Toast[]) => [...prev, newToast]);

    // Auto-remove toast after duration
    setTimeout((): void => {
      setToasts((prev: Toast[]) => prev.filter((t: Toast) => t.id !== id));
    }, duration);
  }, []);

  const removeToast = useCallback((id: string): void => {
    setToasts((prev: Toast[]) => prev.filter((t: Toast) => t.id !== id));
  }, []);

  const value: ToastContextValue = {
    success: (message: string, duration?: number): void => addToast(message, 'success', duration),
    error: (message: string, duration?: number): void => addToast(message, 'error', duration),
    warning: (message: string, duration?: number): void => addToast(message, 'warning', duration),
    info: (message: string, duration?: number): void => addToast(message, 'info', duration),
  };

  const getToastColor = (type: Toast['type']): string => {
    switch (type) {
      case 'success':
        return '$green9';
      case 'error':
        return '$red9';
      case 'warning':
        return '$yellow9';
      case 'info':
        return '$blue9';
      default:
        return '$gray9';
    }
  };

  const getToastIcon = (type: Toast['type']): JSX.Element => {
    const iconProps: { size: number; color: string } = { size: 20, color: 'white' };
    
    switch (type) {
      case 'success':
        return <CheckCircle {...iconProps} />;
      case 'error':
        return <AlertCircle {...iconProps} />;
      case 'warning':
        return <AlertCircle {...iconProps} />;
      case 'info':
        return <Info {...iconProps} />;
      default:
        return <Info {...iconProps} />;
    }
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      
      {/* Toast Container */}
      {toasts.length > 0 && (
        <div
          style={{
            position: 'fixed',
            top: '16px',
            right: '16px',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            pointerEvents: 'none',
            maxWidth: '400px',
          }}
        >
          {toasts.map((toast: Toast) => (
            <Card
              key={toast.id}
              backgroundColor={getToastColor(toast.type)}
              padding="$3"
              borderRadius="$3"
              shadowColor="rgba(0,0,0,0.3)"
              shadowRadius={10}
              shadowOffset={{ width: 0, height: 4 }}
              pointerEvents="auto"
              animation="quick"
              enterStyle={{ opacity: 0, y: -20 }}
              exitStyle={{ opacity: 0, y: -20 }}
            >
              <YStack space="$2">
                <YStack flexDirection="row" alignItems="center" justifyContent="space-between">
                  <YStack flexDirection="row" alignItems="center" space="$2" flex={1}>
                    {getToastIcon(toast.type)}
                    <Text
                      color="white"
                      fontSize="$3"
                      fontWeight="500"
                      flex={1}
                      flexWrap="wrap"
                    >
                      {toast.message}
                    </Text>
                  </YStack>
                  <button
                    onClick={(): void => removeToast(toast.id)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 4,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    aria-label="Close notification"
                  >
                    <X size={16} color="white" />
                  </button>
                </YStack>
              </YStack>
            </Card>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextValue => {
  const context: ToastContextValue | undefined = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

// Export types for use in other files
export type { Toast, ToastContextValue, ToastProviderProps };
