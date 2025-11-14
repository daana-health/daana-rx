import React, { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library';
import { Camera, CameraOff, X } from 'lucide-react';

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

  useEffect(() => {
    if (isOpen) {
      initializeScanner();
    } else {
      stopScanning();
    }

    return () => {
      stopScanning();
    };
  }, [isOpen]);

  const initializeScanner = async () => {
    try {
      setError('');
      
      // Check if mediaDevices API is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError('Camera API not supported in this browser. Please use Chrome, Firefox, Safari, or Edge.');
        return;
      }

      console.log('🎥 Requesting camera access...');

      // Check for HTTPS (required for camera access on deployed sites)
      if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
        setError('Camera access requires HTTPS. Please access the site via https://');
        return;
      }

      // First, enumerate devices to check if any cameras exist
      const initialDevices = await navigator.mediaDevices.enumerateDevices();
      const hasCameras = initialDevices.some(device => device.kind === 'videoinput');
      
      if (!hasCameras) {
        setError('No camera detected on this device. Please ensure your device has a camera and try again.');
        return;
      }

      console.log(`📷 Found ${initialDevices.filter(d => d.kind === 'videoinput').length} camera(s)`);

      // Request camera permission
      let tempStream: MediaStream | null = null;
      try {
        // Use simpler constraints for better compatibility
        tempStream = await navigator.mediaDevices.getUserMedia({ 
          video: true,
          audio: false
        });
        
        console.log('✅ Camera permission granted');
        
        // Keep the stream alive briefly to ensure proper enumeration
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Stop the temporary stream
        tempStream.getTracks().forEach(track => track.stop());
      } catch (permErr: any) {
        console.error('❌ Permission error:', permErr);
        if (permErr.name === 'NotAllowedError' || permErr.name === 'PermissionDeniedError') {
          setError('Camera access denied. Click the camera icon in your browser address bar and allow camera access, then refresh the page.');
        } else if (permErr.name === 'NotFoundError' || permErr.name === 'DevicesNotFoundError') {
          setError('No camera found. Please connect a camera and refresh the page.');
        } else if (permErr.name === 'NotReadableError' || permErr.name === 'TrackStartError') {
          setError('Camera is in use by another application. Please close other apps and try again.');
        } else if (permErr.name === 'OverconstrainedError') {
          setError('Camera constraints not supported. Please try a different camera.');
        } else {
          setError(`Camera error: ${permErr.message || permErr.name}. Please check your browser settings.`);
        }
        return;
      }
      
      // Get available video devices (now with labels after permission granted)
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = allDevices.filter(device => device.kind === 'videoinput');
      
      console.log('📹 Available cameras:', videoDevices.map(d => ({ id: d.deviceId.substring(0, 8), label: d.label })));
      
      if (videoDevices.length === 0) {
        setError('No camera devices found. Please ensure camera permissions are granted and refresh the page.');
        return;
      }

      setDevices(videoDevices);

      // Prefer back camera on mobile devices
      const backCamera = videoDevices.find((device: MediaDeviceInfo) => {
        const label = device.label.toLowerCase();
        return label.includes('back') || label.includes('rear') || label.includes('environment');
      });
      
      // Use back camera if found, otherwise use first available camera
      const deviceId = backCamera?.deviceId || videoDevices[0]!.deviceId;
      console.log(`📸 Using camera: ${videoDevices.find(d => d.deviceId === deviceId)?.label || 'Default camera'}`);
      setSelectedDeviceId(deviceId);
      
      startScanning(deviceId);
    } catch (err: any) {
      console.error('❌ Error initializing scanner:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('Camera access denied. Please allow camera access in your browser settings and refresh.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setError('No camera found. Please ensure your device has a camera.');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setError('Camera is in use by another application.');
      } else {
        setError(`Camera initialization failed: ${err.message || err.name}`);
      }
    }
  };

  const startScanning = async (deviceId: string) => {
    if (!videoRef.current) {
      console.error('Video element not available');
      setError('Video element not ready. Please try again.');
      return;
    }

    try {
      setIsScanning(false); // Set to false initially while we set up
      setError('');

      // Try exact deviceId first, fallback to ideal if that fails
      let stream: MediaStream;
      let actualDeviceId = deviceId;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            deviceId: { exact: deviceId },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        });
      } catch (exactErr: any) {
        // Fallback: try without exact constraint (some browsers need this)
        console.log('Exact deviceId failed, trying fallback:', exactErr.message);
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { 
              deviceId: deviceId,
              width: { ideal: 1280 },
              height: { ideal: 720 }
            }
          });
        } catch (fallbackErr: any) {
          // Last resort: try with facingMode
          console.log('DeviceId failed, trying facingMode:', fallbackErr.message);
          stream = await navigator.mediaDevices.getUserMedia({
            video: { 
              facingMode: 'environment',
              width: { ideal: 1280 },
              height: { ideal: 720 }
            }
          });
          // Get the actual deviceId from the stream
          const videoTrack = stream.getVideoTracks()[0];
          if (videoTrack && videoTrack.getSettings().deviceId) {
            actualDeviceId = videoTrack.getSettings().deviceId!;
            console.log('Using deviceId from stream:', actualDeviceId);
          }
        }
      }

      streamRef.current = stream;

      // Attach stream to video element
      const video = videoRef.current;
      video.srcObject = stream;

      // Wait for video to be ready and play it
      await new Promise<void>((resolve, reject) => {
        const onLoadedMetadata = () => {
          video.removeEventListener('loadedmetadata', onLoadedMetadata);
          video.removeEventListener('error', onError);
          
          // Explicitly play the video (required by Chrome autoplay policy)
          video.play()
            .then(() => {
              console.log('✅ Video playing successfully');
              resolve();
            })
            .catch((playErr: any) => {
              console.error('Error playing video:', playErr);
              reject(new Error('Failed to start video playback: ' + playErr.message));
            });
        };

        const onError = (_err: Event) => {
          video.removeEventListener('loadedmetadata', onLoadedMetadata);
          video.removeEventListener('error', onError);
          reject(new Error('Video element error'));
        };

        video.addEventListener('loadedmetadata', onLoadedMetadata);
        video.addEventListener('error', onError);

        // Timeout after 5 seconds
        setTimeout(() => {
          video.removeEventListener('loadedmetadata', onLoadedMetadata);
          video.removeEventListener('error', onError);
          reject(new Error('Video loading timeout'));
        }, 5000);
      });

      // Now start the barcode reader
      setIsScanning(true);
      const codeReader = new BrowserMultiFormatReader();
      codeReaderRef.current = codeReader;

      // Use actualDeviceId (which may have been updated from stream if we used fallback)
      await codeReader.decodeFromVideoDevice(
        actualDeviceId,
        video,
        (result, err) => {
          if (result) {
            const barcode = result.getText();
            console.log('📷 Scanned barcode:', barcode);
            
            // Only call onScan if barcode is not empty
            if (barcode && barcode.trim()) {
              stopScanning();
              // Small delay to ensure camera is fully released before closing modal and calling callback
              setTimeout(() => {
                onScan(barcode);
                onClose(); // Don't call handleClose here since we already stopped scanning
              }, 50);
            } else {
              console.log('⚠️ Empty barcode detected, ignoring');
            }
          }
          
          if (err && !(err instanceof NotFoundException)) {
            // Only log non-NotFoundException errors (NotFoundException is normal when no barcode detected)
            console.error('Scan error:', err);
          }
        }
      );
    } catch (err: any) {
      console.error('Error starting scanner:', err);
      
      // Stop any stream that might have been created
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('Camera access denied. Please allow camera access and refresh the page.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setError('Camera not found. Please check your camera connection.');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setError('Camera is in use by another application. Please close other apps.');
      } else if (err.message && err.message.includes('playback')) {
        setError('Failed to start camera. Please try again or use a different browser.');
      } else {
        setError('Error starting scanner: ' + (err.message || err.name));
      }
      setIsScanning(false);
    }
  };

  const stopScanning = () => {
    // Stop the code reader
    if (codeReaderRef.current) {
      codeReaderRef.current.reset();
      codeReaderRef.current = null;
    }

    // Stop all video tracks to release camera
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log('📷 Camera track stopped:', track.label);
      });
      streamRef.current = null;
    }

    // Clear video element
    if (videoRef.current) {
      videoRef.current.srcObject = null;
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
            autoPlay
            muted
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

