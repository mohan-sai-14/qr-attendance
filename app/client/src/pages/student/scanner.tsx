import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from "@/lib/auth";
import { SimpleLink } from "@/components/ui/simple-link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ArrowLeft } from 'lucide-react';
import { Loader2 } from "lucide-react";

// Simple HTML5 QR scanner component
const Html5QrScanner = ({ onScan, onError, onRef }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [devices, setDevices] = useState([]);
  const [activeDeviceId, setActiveDeviceId] = useState(null);
  
  // Setup camera stream
  useEffect(() => {
    const setupCamera = async () => {
      try {
        // Get available video devices
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        setDevices(videoDevices);
        
        // Try to select rear camera on mobile
        const rearCamera = videoDevices.find(
          d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('rear')
        );
        
        const deviceId = rearCamera ? rearCamera.deviceId : (videoDevices[0]?.deviceId || null);
        setActiveDeviceId(deviceId);
        
        if (deviceId) {
          const constraints = {
            video: {
              deviceId: { exact: deviceId },
              facingMode: 'environment',
              width: { ideal: 1280 },
              height: { ideal: 720 }
            }
          };
          
          const stream = await navigator.mediaDevices.getUserMedia(constraints);
          setStream(stream);
          
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            onRef && onRef(videoRef.current);
            
            // Start scanning when video is playing
            videoRef.current.onloadedmetadata = () => {
              videoRef.current.play();
              requestAnimationFrame(scanQRCode);
            };
          }
        }
      } catch (err) {
        console.error('Error accessing camera:', err);
        onError && onError(new Error('Failed to access camera. Please ensure you have granted camera permissions.'));
      }
    };
    
    setupCamera();
    
    return () => {
      // Cleanup
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [onRef, onError]);
  
  // Scan QR code from video stream
  const scanQRCode = () => {
    if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      
      // Setup canvas with video dimensions
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      try {
        // This is a placeholder - in a real implementation we would use a QR code detection library
        // For this example, we'll simulate a successful scan after 3 seconds
        setTimeout(() => {
          const simulatedQrData = `https://example.com/attendance?session=${Math.floor(Math.random() * 1000)}`;
          onScan && onScan(simulatedQrData);
        }, 3000);
      } catch (err) {
        console.error('QR detection error:', err);
      }
    }
    
    // Continue scanning
    requestAnimationFrame(scanQRCode);
  };
  
  return (
    <div className="relative">
      <video 
        ref={videoRef} 
        className="w-full h-full object-cover"
        playsInline
        muted
      />
      <canvas 
        ref={canvasRef} 
        className="absolute top-0 left-0 w-full h-full hidden"
      />
      
      {/* Scanner overlay */}
      <div className="absolute inset-0 border-[40px] sm:border-[80px] border-background/70 box-border flex items-center justify-center pointer-events-none">
        <div className="w-full h-full border-2 border-white/50 rounded-md"></div>
      </div>
    </div>
  );
};

export default function StudentScanner({ autoStart = false }) {
  const { user } = useAuth();
  const [scanning, setScanning] = useState(autoStart);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [message, setMessage] = useState('');
  const [redirectUrl, setRedirectUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const videoRef = useRef(null);

  // Handle successful QR scan
  const handleScan = async (data) => {
    if (loading) return; // Prevent multiple submissions
    
    try {
      // Extract session ID from QR code
      const url = new URL(data);
      const sessionId = url.searchParams.get('session');
      
      if (!sessionId) {
        setError('Invalid QR code: No session ID found');
        return;
      }
      
      setLoading(true);
      setMessage(`Processing QR code for session: ${sessionId}...`);
      
      // Call the API directly with fetch instead of using Supabase client
      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          sessionId: sessionId,
          timestamp: new Date().toISOString(),
          userId: user?.id, 
          username: user?.username
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to record attendance');
      }
      
      const result = await response.json();
      
      setSuccess(true);
      setMessage(result.message || 'Attendance recorded successfully');
      setRedirectUrl(result.redirectUrl || '/student');
      
      // Auto redirect after 3 seconds
      setTimeout(() => {
        if (result.redirectUrl) {
          window.location.hash = result.redirectUrl.replace(/^https?:\/\/[^/]+/, '');
        } else {
          window.location.hash = '/student';
        }
      }, 3000);
    } catch (err) {
      console.error('Error processing QR code:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
      setScanning(false);
    }
  };

  // Handle QR scan errors
  const handleError = (err) => {
    console.error('QR Scanner error:', err);
    setError(`QR scanner error: ${err.message}`);
  };

  // Reset the scanner state
  const resetScanner = () => {
    setError(null);
    setSuccess(false);
    setMessage('');
    setScanning(true);
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-lg">
      <div className="mb-6 flex items-center justify-between">
        <SimpleLink to="/student" className="text-foreground/80 hover:text-foreground flex items-center">
          <ArrowLeft className="h-5 w-5 mr-1" />
          <span>Back to Dashboard</span>
        </SimpleLink>
      </div>
      
      <Card className="overflow-hidden">
        <CardContent className="p-0 relative">
          {scanning ? (
            <div className="relative">
              <div 
                className="qr-scanner-container"
                style={{ 
                  position: 'relative',
                  overflow: 'hidden',
                  height: '350px'
                }}
              >
                <Html5QrScanner
                  onScan={handleScan}
                  onError={handleError}
                  onRef={(ref) => { videoRef.current = ref; }}
                />
              </div>
              
              {loading && (
                <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center">
                  <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
                    <p className="font-medium text-lg">{message || 'Processing...'}</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-6 space-y-6">
              {error ? (
                <Alert variant="destructive" className="mb-4">
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : success ? (
                <Alert variant="success" className="mb-4 bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300">
                  <AlertTitle>Success</AlertTitle>
                  <AlertDescription>{message}</AlertDescription>
                </Alert>
              ) : null}
              
              <div className="flex justify-between">
                <Button 
                  onClick={resetScanner}
                  variant="outline"
                >
                  Scan Again
                </Button>
                
                <SimpleLink to="/student">
                  <Button>Back to Dashboard</Button>
                </SimpleLink>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      <div className="mt-6">
        <p className="text-sm text-muted-foreground text-center">
          Position the QR code within the frame to scan
        </p>
      </div>
    </div>
  );
}
