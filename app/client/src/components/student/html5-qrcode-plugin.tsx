import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

const qrcodeRegionId = "html5qr-code-full-region";

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
  const currentCamera = useRef<string | null>(null);

  useEffect(() => {
    // when component mounts
    const config = {
      fps: props.fps || 10,
      qrbox: props.qrbox || 250,
      disableFlip: props.disableFlip || false,
      verbose: props.verbose === true,
    };

    // Cleanup function
    return () => {
      if (html5QrCode.current && isScanning.current) {
        html5QrCode.current.stop().catch(error => console.error('Error stopping scanner:', error));
        isScanning.current = false;
      }
    };
  }, [props.fps, props.qrbox, props.disableFlip, props.verbose]);

  // Check if zoom is supported
  useEffect(() => {
    const checkZoomSupport = async () => {
      try {
        // Get default video device
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        
        // Get track capabilities
        const videoTrack = stream.getVideoTracks()[0];
        const capabilities = videoTrack.getCapabilities();
        
        // Check if zoom is supported
        if (capabilities.zoom) {
          setShowZoomControls(true);
          console.log('Zoom is supported with range:', capabilities.zoom.min, 'to', capabilities.zoom.max);
        } else {
          console.log('Zoom is not supported on this device');
          setShowZoomControls(false);
        }
        
        // Always stop the stream when done
        stream.getTracks().forEach(track => track.stop());
      } catch (error) {
        console.error('Error checking zoom support:', error);
        setShowZoomControls(false);
      }
    };
    
    checkZoomSupport();
  }, []);

  // Apply zoom to active video track
  const applyZoom = async (level: number) => {
    try {
      if (!html5QrCode.current || !isScanning.current) return;
      
      // Get current scanner's video element
      const videoElement = document.querySelector('#html5qr-code-full-region video') as HTMLVideoElement;
      if (!videoElement || !videoElement.srcObject) return;
      
      // Apply zoom constraints to the active track
      const videoTrack = (videoElement.srcObject as MediaStream).getVideoTracks()[0];
      if (!videoTrack) return;
      
      // Check if constraints are supported
      const capabilities = videoTrack.getCapabilities();
      if (!capabilities.zoom) return;
      
      // Ensure zoom level is within range
      const zoomMin = capabilities.zoom.min || 1;
      const zoomMax = capabilities.zoom.max || 5;
      const clampedZoom = Math.max(zoomMin, Math.min(level, zoomMax));
      
      // Apply zoom
      await videoTrack.applyConstraints({
        advanced: [{ zoom: clampedZoom }]
      });
      
      console.log('Applied zoom level:', clampedZoom);
      setZoomLevel(clampedZoom);
    } catch (error) {
      console.error('Error applying zoom:', error);
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
    if (html5QrCode.current === null) {
      html5QrCode.current = new Html5Qrcode(qrcodeRegionId);
    }

    const startScanner = async () => {
      try {
        const devices = await Html5Qrcode.getCameras();
        console.log('Available cameras:', devices);
        
        if (devices && devices.length > 0) {
          // Special handling for mobile devices
          let cameraId = devices[0].id;
          
          // On mobile, prefer back camera (usually index 0 is front camera)
          if (devices.length > 1 && /Mobile|Android|iOS|iPhone|iPad/i.test(navigator.userAgent)) {
            // Try to find the back camera by checking device labels
            const backCamera = devices.find(camera => {
              const label = camera.label.toLowerCase();
              return (
                label.includes('back') || 
                label.includes('rear') || 
                label.includes('environment') ||
                !label.includes('front')
              );
            });
            
            if (backCamera) {
              cameraId = backCamera.id;
              console.log('Selected back camera:', backCamera.label);
            } else {
              // If no clear back camera, use the last camera in the list
              // (often the back camera on mobile devices)
              cameraId = devices[devices.length - 1].id;
              console.log('Using last camera as back camera:', devices[devices.length - 1].label);
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
            // Use environment facing mode for mobile
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
          
          // Once camera is started, set initial zoom level after a delay
          // to ensure camera is fully initialized
          setTimeout(() => {
            applyZoom(zoomLevel);
          }, 1000);
        } else {
          console.error('No cameras found');
          if (props.qrCodeErrorCallback) {
            props.qrCodeErrorCallback('No cameras found', null);
          }
        }
      } catch (error) {
        console.error('Error starting scanner:', error);
        if (props.qrCodeErrorCallback) {
          props.qrCodeErrorCallback('Error starting scanner', error);
        }
      }
    };

    startScanner();
  }, [props.qrCodeSuccessCallback, props.qrCodeErrorCallback]);

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
