import React, { useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

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
      <p className="text-center text-sm text-gray-500 mt-4">
        Position the QR code within the frame
      </p>
    </div>
  );
};
