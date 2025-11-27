'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
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
  const mountedRef = useRef(true);

  // Cleanup function to stop all camera streams
  const stopAllCameraStreams = useCallback(async () => {
    try {
      // Stop the Html5Qrcode scanner if it exists
      if (scannerRef.current) {
        try {
          const state = scannerRef.current.getState();
          if (state === 2) { // Html5QrcodeScannerState.SCANNING
            await scannerRef.current.stop();
          }
        } catch (err) {
          // Scanner might already be stopped
          console.log('Scanner already stopped or not started');
        }
        try {
          await scannerRef.current.clear();
        } catch (err) {
          // Ignore clear errors
        }
        scannerRef.current = null;
      }

      // Additionally, stop any lingering media streams
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      
      if (videoDevices.length > 0) {
        // Get all video elements and stop their streams
        const videoElements = document.querySelectorAll('video');
        videoElements.forEach(video => {
          if (video.srcObject) {
            const stream = video.srcObject as MediaStream;
            stream.getTracks().forEach(track => {
              track.stop();
            });
            video.srcObject = null;
          }
        });
      }

      if (mountedRef.current) {
        setIsScanning(false);
      }
    } catch (err) {
      console.error('Error stopping camera streams:', err);
    }
  }, []);

  // Effect to handle modal open/close
  useEffect(() => {
    mountedRef.current = true;

    if (!opened) {
      // Modal is closing, stop everything
      stopAllCameraStreams();
      if (mountedRef.current) {
        setShowManualInput(false);
        setManualCode('');
        setError('');
      }
      return;
    }

    // Modal is opening, start scanner after a short delay to ensure DOM is ready
    const startTimer = setTimeout(() => {
      if (mountedRef.current && opened) {
        startScanner();
      }
    }, 100);

    return () => {
      clearTimeout(startTimer);
      mountedRef.current = false;
      stopAllCameraStreams();
    };
  }, [opened, stopAllCameraStreams]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      stopAllCameraStreams();
    };
  }, [stopAllCameraStreams]);

  const requestCameraPermission = async (): Promise<boolean> => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError('Camera is not supported on this browser. Please use manual entry.');
        return false;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      
      // Stop the test stream immediately
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
    if (!mountedRef.current) return;

    try {
      setIsScanning(true);
      setError('');

      const hasPermission = await requestCameraPermission();
      if (!hasPermission || !mountedRef.current) {
        setIsScanning(false);
        setShowManualInput(true);
        return;
      }

      // Make sure any previous instance is cleaned up
      await stopAllCameraStreams();

      const html5QrCode = new Html5Qrcode(scannerId);
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          if (mountedRef.current) {
            handleScan(decodedText);
          }
        },
        () => {
          // Ignore decode errors (continuous scanning)
        }
      );
    } catch (err: any) {
      console.error('Error starting barcode scanner:', err);
      if (mountedRef.current) {
        setError('Failed to start camera. Please check permissions or use manual entry.');
        setIsScanning(false);
        setShowManualInput(true);
      }
    }
  };

  const handleScan = async (code: string) => {
    await stopAllCameraStreams();
    onScan(code);
  };

  const handleManualSubmit = async () => {
    if (manualCode.trim()) {
      await stopAllCameraStreams();
      onScan(manualCode.trim());
      setManualCode('');
    }
  };

  const handleClose = async () => {
    await stopAllCameraStreams();
    onClose();
  };

  const handleSwitchToManual = async () => {
    await stopAllCameraStreams();
    setShowManualInput(true);
  };

  const handleSwitchToScanner = () => {
    setShowManualInput(false);
    setManualCode('');
    startScanner();
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={title}
      size="lg"
      centered
      closeOnClickOutside={false}
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
                minHeight: '300px',
              }}
            />

            <Group justify="space-between">
              <Button
                variant="subtle"
                leftSection={<IconKeyboard size={16} />}
                onClick={handleSwitchToManual}
              >
                Manual Entry
              </Button>
              <Button onClick={handleClose}>
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
                onClick={handleSwitchToScanner}
              >
                Back to Scanner
              </Button>
              <Group>
                <Button variant="light" onClick={handleManualSubmit}>
                  Submit
                </Button>
                <Button onClick={handleClose}>
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
