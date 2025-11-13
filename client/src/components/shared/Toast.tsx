import React, { useEffect } from 'react';
import { YStack, Text } from 'tamagui';
import { CheckCircle, XCircle, Info, AlertTriangle } from 'lucide-react';

export interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({
  message,
  type = 'info',
  duration = 3000,
  onClose
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle size={20} color="#10b981" />;
      case 'error':
        return <XCircle size={20} color="#ef4444" />;
      case 'warning':
        return <AlertTriangle size={20} color="#f59e0b" />;
      default:
        return <Info size={20} color="#3b82f6" />;
    }
  };

  const getBackgroundColor = () => {
    switch (type) {
      case 'success':
        return '$green2';
      case 'error':
        return '$red2';
      case 'warning':
        return '$yellow2';
      default:
        return '$blue2';
    }
  };

  const getBorderColor = () => {
    switch (type) {
      case 'success':
        return '$green8';
      case 'error':
        return '$red8';
      case 'warning':
        return '$yellow8';
      default:
        return '$blue8';
    }
  };

  return (
    <YStack
      // @ts-ignore - YStack doesn't support position="fixed" in types
      position="fixed"
      top="$4"
      right="$4"
      backgroundColor={getBackgroundColor()}
      borderWidth={2}
      borderColor={getBorderColor()}
      borderRadius="$4"
      padding="$4"
      minWidth={300}
      maxWidth={500}
      shadowColor="$shadowColor"
      shadowRadius={8}
      shadowOpacity={0.2}
      zIndex={9999}
      animation="quick"
      enterStyle={{ opacity: 0, y: -20 }}
      exitStyle={{ opacity: 0, y: -20 }}
      $xs={{ left: "$4", right: "$4", minWidth: 0 }}
    >
      <YStack flexDirection="row" alignItems="center" space="$3">
        {getIcon()}
        <Text flex={1} fontSize="$4" color="$color" flexWrap="wrap">
          {message}
        </Text>
      </YStack>
    </YStack>
  );
};

export default Toast;
