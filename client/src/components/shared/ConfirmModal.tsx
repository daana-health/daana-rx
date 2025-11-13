import React from 'react';
import { Dialog, XStack, YStack, H3, Button, Text } from 'tamagui';
import { X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message?: string;
  confirmText?: string;
  confirmColor?: 'red' | 'blue';
  children?: React.ReactNode;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message,
  confirmText = 'Confirm',
  confirmColor = 'red',
  children
}) => {
  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const confirmBgColor = confirmColor === 'red' ? '$red' : '$blue';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay
          key="overlay"
          animation="quick"
          opacity={0.5}
          enterStyle={{ opacity: 0 }}
          exitStyle={{ opacity: 0 }}
          backgroundColor="rgba(0,0,0,0.4)"
          // @ts-ignore - Dialog.Overlay doesn't support position in types
          position="fixed"
          inset={0}
          zIndex={50}
          onPress={onClose}
        />
        <Dialog.Content
          bordered
          elevate
          key="content"
          animation={[
            'quick',
            {
              opacity: {
                overshootClamping: true,
              },
            },
          ]}
          enterStyle={{ x: 0, y: -20, opacity: 0, scale: 0.9 }}
          exitStyle={{ x: 0, y: 10, opacity: 0, scale: 0.95 }}
          backgroundColor="$background"
          borderRadius="$4"
          padding="$6"
          maxWidth={500}
          width="90%"
          $xs={{ width: "95%", maxWidth: "95%" }}
          $sm={{ width: "90%", maxWidth: 450 }}
          marginHorizontal="auto"
          position="relative"
          zIndex={51}
        >
          <YStack space="$4">
            <XStack justifyContent="space-between" alignItems="center" borderBottomWidth={1} borderBottomColor="$borderColor" paddingBottom="$4">
              <Dialog.Title asChild>
                <H3 fontSize="$7" fontWeight="600" color="$color">{title}</H3>
              </Dialog.Title>
              <Dialog.Close asChild>
                <Button 
                  unstyled
                  onPress={onClose}
                  padding="$0"
                  chromeless
                  circular
                  icon={<X size={24} color="var(--gray)" />}
                  hoverStyle={{ opacity: 0.7 }}
                  pressStyle={{ opacity: 0.5 }}
                />
              </Dialog.Close>
            </XStack>
            {children ? children : <Text paddingVertical="$4" color="$color">{message}</Text>}
            <XStack justifyContent="flex-end" space="$3" paddingTop="$4" borderTopWidth={1} borderTopColor="$borderColor">
              <Button 
                size="$4"
                onPress={onClose}
                backgroundColor="$gray"
                color="white"
                hoverStyle={{ backgroundColor: "#4b5563" }}
                pressStyle={{ backgroundColor: "#374151" }}
                $xs={{ flex: 1 }}
              >
                Cancel
              </Button>
              <Button 
                size="$4"
                onPress={handleConfirm}
                backgroundColor={confirmBgColor}
                color="white"
                hoverStyle={{ opacity: 0.9 }}
                pressStyle={{ opacity: 0.8 }}
                $xs={{ flex: 1 }}
              >
                {confirmText}
              </Button>
            </XStack>
          </YStack>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
};

export default ConfirmModal;

