'use client';

import { useEffect, useRef, useState } from 'react';
import { Modal, Button, Group, Text, Stack, Alert, TextInput } from '@mantine/core';
import { IconCamera, IconAlertCircle, IconKeyboard } from '@tabler/icons-react';
import { Html5Qrcode } from 'html5-qrcode';

interface BarcodeScannerProps {
  opened: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
  title?: string;
  description?: string;
}

export function BarcodeScanner({
  opened,
  onClose,
  onScan,
  title = 'Scan NDC Barcode',
  description = 'Position the barcode within the frame',
}: BarcodeScannerProps) {
  const scannerId = 'barcode-reader';
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

  const requestCameraPermission = async (): Promise<boolean> => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError('Camera is not supported on this browser. Please use manual entry.');
        return false;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (err: any) {
      console.error('Camera permission error:', err);
      
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('Camera permission denied. Please enable camera access in your browser settings and reload.');
      } else if (err.name === 'NotFoundError') {
        setError('No camera found on this device. Please use manual entry.');
      } else if (err.name === 'NotReadableError') {
        setError('Camera is already in use by another application.');
      } else {
        setError('Failed to access camera. Please check permissions or use manual entry.');
      }
      return false;
    }
  };

  const startScanner = async () => {
    try {
      setIsScanning(true);
      setError('');

      const hasPermission = await requestCameraPermission();
      if (!hasPermission) {
        setIsScanning(false);
        setShowManualInput(true);
        return;
      }

      const html5QrCode = new Html5Qrcode(scannerId);
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
      console.error('Error starting barcode scanner:', err);
      setError('Failed to start camera. Please check permissions or use manual entry.');
      setIsScanning(false);
      setShowManualInput(true);
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
              id={scannerId}
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
              label="NDC Barcode"
              placeholder="Enter NDC code manually"
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
                leftSection={<IconCamera size={16} />}
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

