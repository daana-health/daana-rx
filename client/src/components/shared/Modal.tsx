import React from 'react';
import { Dialog, XStack, YStack, H3, Button, View } from 'tamagui';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

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
            <View>{children}</View>
          </YStack>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
};

export default Modal;

