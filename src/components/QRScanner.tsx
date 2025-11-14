'use client';

import { useEffect, useRef, useState } from 'react';
import { Modal, Button, Group, Text, Stack, Alert, TextInput } from '@mantine/core';
import { IconQrcode, IconAlertCircle, IconKeyboard } from '@tabler/icons-react';
import { Html5Qrcode } from 'html5-qrcode';

interface QRScannerProps {
  opened: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
  title?: string;
  description?: string;
}

export function QRScanner({
  opened,
  onClose,
  onScan,
  title = 'Scan QR Code',
  description = 'Position the QR code within the frame',
}: QRScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string>('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualCode, setManualCode] = useState('');

  useEffect(() => {
    if (!opened) {
      stopScanner();
      return;
    }

    startScanner();

    return () => {
      stopScanner();
    };
  }, [opened]);

  const startScanner = async () => {
    try {
      setIsScanning(true);
      setError('');

      const html5QrCode = new Html5Qrcode('qr-reader');
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          handleScan(decodedText);
        },
        () => {
          // Ignore decode errors (continuous scanning)
        }
      );
    } catch (err: any) {
      console.error('Error starting QR scanner:', err);
      setError(
        'Failed to start camera. Please check permissions or use manual entry.'
      );
      setIsScanning(false);
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current && isScanning) {
      try {
        await scannerRef.current.stop();
        scannerRef.current = null;
        setIsScanning(false);
      } catch (err) {
        console.error('Error stopping scanner:', err);
      }
    }
  };

  const handleScan = (code: string) => {
    stopScanner();
    onScan(code);
  };

  const handleManualSubmit = () => {
    if (manualCode.trim()) {
      stopScanner();
      onScan(manualCode.trim());
      setManualCode('');
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={() => {
        stopScanner();
        onClose();
      }}
      title={title}
      size="lg"
      centered
    >
      <Stack>
        <Text size="sm" c="dimmed">
          {description}
        </Text>

        {error && (
          <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red">
            {error}
          </Alert>
        )}

        {!showManualInput ? (
          <>
            <div
              id="qr-reader"
              style={{
                width: '100%',
                borderRadius: '8px',
                overflow: 'hidden',
              }}
            />

            <Group justify="space-between">
              <Button
                variant="subtle"
                leftSection={<IconKeyboard size={16} />}
                onClick={() => {
                  stopScanner();
                  setShowManualInput(true);
                }}
              >
                Manual Entry
              </Button>
              <Button
                onClick={() => {
                  stopScanner();
                  onClose();
                }}
              >
                Cancel
              </Button>
            </Group>
          </>
        ) : (
          <>
            <TextInput
              label="Unit ID"
              placeholder="Enter unit ID manually"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleManualSubmit();
                }
              }}
              autoFocus
            />

            <Group justify="space-between">
              <Button
                variant="subtle"
                leftSection={<IconQrcode size={16} />}
                onClick={() => {
                  setShowManualInput(false);
                  setManualCode('');
                  startScanner();
                }}
              >
                Back to Scanner
              </Button>
              <Group>
                <Button variant="light" onClick={handleManualSubmit}>
                  Submit
                </Button>
                <Button
                  onClick={() => {
                    stopScanner();
                    onClose();
                  }}
                >
                  Cancel
                </Button>
              </Group>
            </Group>
          </>
        )}
      </Stack>
    </Modal>
  );
}

