import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

const qrcodeRegionId = "html5qr-code-full-region";

interface ExtendedMediaTrackCapabilities extends MediaTrackCapabilities {
  zoom?: {
    min: number;
    max: number;
    step: number;
  };
}

interface ZoomConstraint {
  zoom: number;
}

interface HTML5QrcodePluginProps {
  fps?: number;
  qrbox?: number;
  disableFlip?: boolean;
  verbose?: boolean;
  qrCodeSuccessCallback: (decodedText: string, decodedResult: any) => void;
  qrCodeErrorCallback?: (errorMessage: string, error: any) => void;
}

export const Html5QrcodePlugin: React.FC<HTML5QrcodePluginProps> = (props) => {
  const html5QrCode = useRef<Html5Qrcode | null>(null);
  const isScanning = useRef<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [showZoomControls, setShowZoomControls] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const currentCamera = useRef<string | null>(null);

  useEffect(() => {
    // Cleanup function
    return () => {
      if (html5QrCode.current && isScanning.current) {
        html5QrCode.current.stop().catch(error => {
          console.error('Error stopping scanner:', error);
        });
        isScanning.current = false;
      }
    };
  }, []);

  const checkCameraCapabilities = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      const videoTrack = stream.getVideoTracks()[0];
      const capabilities = videoTrack.getCapabilities() as ExtendedMediaTrackCapabilities;
      
      if (capabilities.zoom) {
        setShowZoomControls(true);
        setZoomLevel(capabilities.zoom.min || 1.0);
        console.log('Zoom is supported with range:', capabilities.zoom.min, 'to', capabilities.zoom.max);
      } else {
        setShowZoomControls(false);
        console.log('Zoom is not supported on this device');
      }
      
      stream.getTracks().forEach(track => track.stop());
    } catch (error) {
      console.error('Error checking camera capabilities:', error);
      setShowZoomControls(false);
      setError('Failed to access camera. Please ensure camera permissions are granted.');
    }
  };

  const applyZoom = async (level: number) => {
    try {
      if (!html5QrCode.current || !isScanning.current) return;
      
      const videoElement = document.querySelector('#html5qr-code-full-region video') as HTMLVideoElement;
      if (!videoElement || !videoElement.srcObject) return;
      
      const videoTrack = (videoElement.srcObject as MediaStream).getVideoTracks()[0];
      if (!videoTrack) return;
      
      const capabilities = videoTrack.getCapabilities() as ExtendedMediaTrackCapabilities;
      if (!capabilities.zoom) return;
      
      const zoomMin = capabilities.zoom.min || 1;
      const zoomMax = capabilities.zoom.max || 5;
      const clampedZoom = Math.max(zoomMin, Math.min(level, zoomMax));
      
      const constraints: MediaTrackConstraints = {
        advanced: [{ zoom: clampedZoom } as ZoomConstraint]
      };
      
      await videoTrack.applyConstraints(constraints);
      setZoomLevel(clampedZoom);
    } catch (error) {
      console.error('Error applying zoom:', error);
      setError('Failed to apply zoom. Please try again.');
    }
  };

  const handleZoomIn = () => {
    const newZoom = zoomLevel + 0.5;
    applyZoom(newZoom);
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(1, zoomLevel - 0.5);
    applyZoom(newZoom);
  };

  useEffect(() => {
    const initializeScanner = async () => {
      try {
        if (html5QrCode.current === null) {
          html5QrCode.current = new Html5Qrcode(qrcodeRegionId);
        }

        const devices = await Html5Qrcode.getCameras();
        if (!devices || devices.length === 0) {
          setError('No cameras found. Please ensure your device has a camera.');
          return;
        }

        // Try to find the back camera on mobile devices
        let cameraId = devices[0].id;
        if (devices.length > 1 && /Mobile|Android|iOS|iPhone|iPad/i.test(navigator.userAgent)) {
          const backCamera = devices.find(camera => {
            const label = camera.label.toLowerCase();
            return label.includes('back') || label.includes('rear') || label.includes('environment');
          });
          
          if (backCamera) {
            cameraId = backCamera.id;
          } else {
            cameraId = devices[devices.length - 1].id;
          }
        }

        currentCamera.current = cameraId;
        
        const config = {
          fps: props.fps || 10,
          qrbox: {
            width: props.qrbox || 250,
            height: props.qrbox || 250
          },
          aspectRatio: 1.0,
          videoConstraints: {
            deviceId: cameraId,
            facingMode: "environment",
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        };

        await html5QrCode.current.start(
          cameraId,
          config,
          props.qrCodeSuccessCallback,
          props.qrCodeErrorCallback || (() => {})
        );
        
        isScanning.current = true;
        await checkCameraCapabilities();
        
        // Set initial zoom after camera is initialized
        setTimeout(() => {
          applyZoom(zoomLevel);
        }, 1000);
      } catch (error) {
        console.error('Error initializing scanner:', error);
        setError('Failed to initialize camera. Please try again.');
        if (props.qrCodeErrorCallback) {
          props.qrCodeErrorCallback('Error initializing scanner', error);
        }
      }
    };

    initializeScanner();
  }, [props.qrCodeSuccessCallback, props.qrCodeErrorCallback]);

  if (error) {
    return (
      <div className="text-center p-4">
        <p className="text-red-500">{error}</p>
        <Button 
          variant="outline" 
          onClick={() => {
            setError(null);
            initializeScanner();
          }}
          className="mt-4"
        >
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="relative">
      <div id={qrcodeRegionId} style={{ width: '100%', maxWidth: '500px', margin: '0 auto' }}></div>
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <div className="border-2 border-primary w-[250px] h-[250px] rounded-lg opacity-50"></div>
      </div>
      
      {showZoomControls && (
        <div className="mt-3 flex justify-center gap-4">
          <Button 
            size="sm"
            variant="outline" 
            onClick={handleZoomOut}
            disabled={zoomLevel <= 1}
            className="p-2"
          >
            <ZoomOut className="h-5 w-5" />
          </Button>
          <span className="flex items-center text-sm font-medium">
            {zoomLevel.toFixed(1)}x
          </span>
          <Button 
            size="sm"
            variant="outline" 
            onClick={handleZoomIn}
            className="p-2"
          >
            <ZoomIn className="h-5 w-5" />
          </Button>
        </div>
      )}
      
      <p className="text-center text-sm text-gray-500 mt-4">
        Position the QR code within the frame
      </p>
    </div>
  );
};
