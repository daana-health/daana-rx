import React, { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library';
import { Camera, CameraOff, X } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

interface BarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
  title?: string;
}

const BarcodeScanner: React.FC<BarcodeScannerProps> = ({
  isOpen,
  onClose,
  onScan,
  title = "Scan Barcode"
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string>('');
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isMountedRef = useRef<boolean>(true);
  const toast = useToast();

  useEffect(() => {
    isMountedRef.current = true;

    if (isOpen) {
      // Reset state when opening
      setError('');
      setDevices([]);
      setSelectedDeviceId('');
      initializeScanner();
    } else {
      stopScanning();
    }

    return () => {
      isMountedRef.current = false;
      stopScanning();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const initializeScanner = async () => {
    if (!isMountedRef.current) return;

    try {
      setError('');

      // Get available video devices first
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = allDevices.filter(device => device.kind === 'videoinput');

      if (!isMountedRef.current) return;

      if (videoDevices.length === 0) {
        setError('No camera found. Please connect a camera and try again.');
        return;
      }

      setDevices(videoDevices);

      // Prefer back camera on mobile devices
      const backCamera = videoDevices.find((device: MediaDeviceInfo) =>
        device.label.toLowerCase().includes('back') ||
        device.label.toLowerCase().includes('rear')
      );

      const deviceId: string = backCamera?.deviceId || videoDevices[0]?.deviceId || '';
      if (!deviceId) {
        setError('No valid camera device found.');
        return;
      }
      setSelectedDeviceId(deviceId);

      // Start scanning with the selected device
      if (isMountedRef.current) {
        await startScanning(deviceId);
      }
    } catch (err: any) {
      console.error('Error initializing scanner:', err);
      if (!isMountedRef.current) return;

      if (err.name === 'NotAllowedError') {
        setError('Camera access denied. Please allow camera access in your browser settings.');
      } else if (err.name === 'NotFoundError') {
        setError('No camera found. Please connect a camera and try again.');
      } else {
        setError('Error accessing camera: ' + err.message);
      }
    }
  };

  const startScanning = async (deviceId: string) => {
    if (!videoRef.current || !isMountedRef.current) return;

    try {
      setIsScanning(true);
      setError('');

      // Get the media stream and store reference
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId } }
      });

      if (!isMountedRef.current) {
        // Component unmounted during async operation, cleanup stream
        stream.getTracks().forEach(track => track.stop());
        return;
      }

      streamRef.current = stream;

      // Attach stream to video element
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      const codeReader = new BrowserMultiFormatReader();
      codeReaderRef.current = codeReader;

      await codeReader.decodeFromVideoDevice(
        deviceId,
        videoRef.current,
        (result, err) => {
          if (!isMountedRef.current) return;

          if (result) {
            const barcode = result.getText();
            console.log('📷 Scanned barcode:', barcode);

            // Only call onScan if barcode is not empty
            if (barcode && barcode.trim()) {
              stopScanning();
              toast.success('Barcode scanned successfully!', 2000);
              // Small delay to ensure camera is fully released before closing modal and calling callback
              setTimeout(() => {
                if (isMountedRef.current) {
                  onScan(barcode);
                  onClose();
                }
              }, 50);
            } else {
              console.log('⚠️ Empty barcode detected, ignoring');
              toast.warning('Empty barcode detected, please try again', 2000);
            }
          }

          if (err && !(err instanceof NotFoundException)) {
            console.error('Scan error:', err);
          }
        }
      );
    } catch (err: any) {
      console.error('Error starting scanner:', err);
      if (!isMountedRef.current) return;
      setError('Error starting scanner: ' + err.message);
      setIsScanning(false);
    }
  };

  const stopScanning = () => {
    console.log('🛑 Stopping scanner...');

    // Stop the code reader first
    if (codeReaderRef.current) {
      try {
        codeReaderRef.current.reset();
        console.log('📷 Code reader reset');
      } catch (err) {
        console.error('Error resetting code reader:', err);
      }
      codeReaderRef.current = null;
    }

    // Stop all video tracks to release camera
    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach(track => {
          track.stop();
          console.log('📷 Camera track stopped:', track.label);
        });
      } catch (err) {
        console.error('Error stopping camera tracks:', err);
      }
      streamRef.current = null;
    }

    // Clear video element
    if (videoRef.current) {
      try {
        videoRef.current.srcObject = null;
        // Pause the video to ensure complete cleanup
        videoRef.current.pause();
      } catch (err) {
        console.error('Error clearing video element:', err);
      }
    }

    setIsScanning(false);
    console.log('🔴 Camera access released');
  };

  const handleDeviceChange = (deviceId: string) => {
    setSelectedDeviceId(deviceId);
    stopScanning();
    startScanning(deviceId);
  };

  const handleClose = () => {
    stopScanning();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80"
      onClick={handleClose}
    >
      <div 
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b bg-gray-50">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-blue-600" />
            <h3 className="text-xl font-semibold text-gray-900">{title}</h3>
          </div>
          <button 
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Close scanner"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Camera View */}
        <div className="relative bg-black">
          <video 
            ref={videoRef}
            className="w-full h-96 object-cover"
            playsInline
          />
          
          {/* Scanning Overlay */}
          {isScanning && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-64 h-48 border-4 border-blue-500 rounded-lg relative">
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-blue-500"></div>
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-blue-500"></div>
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-blue-500"></div>
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-blue-500"></div>
                
                {/* Scanning line animation */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500 animate-scan-line"></div>
              </div>
            </div>
          )}

          {/* Status Indicator */}
          <div className="absolute top-4 left-4 right-4">
            {isScanning ? (
              <div className="bg-green-500 text-white px-4 py-2 rounded-md flex items-center gap-2">
                <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
                <span>Scanning... Position barcode in the frame</span>
              </div>
            ) : error ? (
              <div className="bg-red-500 text-white px-4 py-2 rounded-md flex items-center gap-2">
                <CameraOff className="w-4 h-4" />
                <span>{error}</span>
              </div>
            ) : (
              <div className="bg-blue-500 text-white px-4 py-2 rounded-md">
                Initializing camera...
              </div>
            )}
          </div>
        </div>

        {/* Footer with camera selection */}
        {devices.length > 1 && (
          <div className="p-4 border-t bg-gray-50">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Camera:
            </label>
            <select 
              value={selectedDeviceId}
              onChange={(e) => handleDeviceChange(e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              {devices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Camera ${device.deviceId.substring(0, 8)}`}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Instructions */}
        <div className="p-4 bg-blue-50 border-t">
          <p className="text-sm text-blue-800">
            <strong>Tips:</strong> Hold the barcode steady in the frame. Works best with good lighting. 
            Barcodes on prescription bottles typically use Code 128 or Code 39 format.
          </p>
        </div>

        {/* Manual Entry Option */}
        <div className="p-4 border-t text-center">
          <button 
            onClick={onClose}
            className="text-sm text-gray-600 hover:text-gray-800 underline"
          >
            Cancel and enter manually instead
          </button>
        </div>
      </div>

      {/* Add scanning animation styles */}
      <style>{`
        @keyframes scan-line {
          0% {
            top: 0;
          }
          50% {
            top: 100%;
          }
          100% {
            top: 0;
          }
        }
        
        .animate-scan-line {
          animation: scan-line 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default BarcodeScanner;

