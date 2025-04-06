import React, { useState, useRef, useEffect } from 'react';
import { QrScanner } from '@yudiel/react-qr-scanner';
import { useAuth } from "@/lib/auth";
import { SimpleLink } from "@/components/ui/simple-link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ArrowLeft, FlipCamera, ZoomIn, ZoomOut } from 'lucide-react';
import { Loader2 } from "lucide-react";

export default function StudentScanner({ autoStart = false }) {
  const { user } = useAuth();
  const [scanning, setScanning] = useState(autoStart);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const [message, setMessage] = useState<string>('');
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedCamera, setSelectedCamera] = useState<string | null>(null);
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [zoom, setZoom] = useState<number>(1);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Get available cameras
  useEffect(() => {
    const getAvailableCameras = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        setAvailableCameras(videoDevices);
        
        // Select rear camera by default on mobile devices
        const rearCamera = videoDevices.find(
          d => d.label.toLowerCase().includes('back') || 
               d.label.toLowerCase().includes('rear')
        );
        
        if (rearCamera) {
          setSelectedCamera(rearCamera.deviceId);
        } else if (videoDevices.length > 0) {
          // Otherwise use the first camera
          setSelectedCamera(videoDevices[0].deviceId);
        }
      } catch (err) {
        console.error('Error accessing cameras:', err);
        setError('Unable to access cameras. Please ensure camera permissions are granted.');
      }
    };
    
    getAvailableCameras();
  }, []);

  // Handle camera switching
  const switchCamera = () => {
    if (availableCameras.length <= 1) return;
    
    const currentIndex = availableCameras.findIndex(cam => cam.deviceId === selectedCamera);
    const nextIndex = (currentIndex + 1) % availableCameras.length;
    setSelectedCamera(availableCameras[nextIndex].deviceId);
  };

  // Zoom functions
  const increaseZoom = () => {
    setZoom(prevZoom => Math.min(prevZoom + 0.5, 5));
  };

  const decreaseZoom = () => {
    setZoom(prevZoom => Math.max(prevZoom - 0.5, 1));
  };

  // Apply zoom effect
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.style.transform = `scale(${zoom})`;
    }
  }, [zoom, videoRef]);

  // Handle successful QR scan
  const handleScan = async (data: string) => {
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
  const handleError = (err: Error) => {
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
        
        {availableCameras.length > 1 && (
          <Button 
            variant="outline" 
            size="icon"
            onClick={switchCamera}
            disabled={loading}
            title="Switch Camera"
          >
            <FlipCamera className="h-5 w-5" />
          </Button>
        )}
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
                <QrScanner
                  onDecode={handleScan}
                  onError={handleError}
                  containerStyle={{
                    height: '100%',
                    padding: '0'
                  }}
                  videoId="qr-scanner-video"
                  videoStyle={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    transform: `scale(${zoom})`,
                    transformOrigin: 'center center',
                    transition: 'transform 0.3s ease-in-out'
                  }}
                  constraints={{
                    video: {
                      facingMode: "environment",
                      deviceId: selectedCamera ? { exact: selectedCamera } : undefined,
                      width: { ideal: 1280 },
                      height: { ideal: 720 }
                    }
                  }}
                  onRef={(ref) => { videoRef.current = ref; }}
                />
                
                {/* QR Scanner Overlay */}
                <div className="absolute inset-0 border-[40px] sm:border-[80px] border-background/70 box-border flex items-center justify-center pointer-events-none">
                  <div className="w-full h-full border-2 border-white/50 rounded-md"></div>
                </div>
                
                {/* Zoom controls */}
                <div className="absolute bottom-4 right-4 flex flex-col gap-2">
                  <Button 
                    variant="secondary" 
                    size="icon" 
                    className="rounded-full bg-background/80 backdrop-blur-sm"
                    onClick={increaseZoom}
                  >
                    <ZoomIn className="h-5 w-5" />
                  </Button>
                  <Button 
                    variant="secondary" 
                    size="icon" 
                    className="rounded-full bg-background/80 backdrop-blur-sm"
                    onClick={decreaseZoom}
                  >
                    <ZoomOut className="h-5 w-5" />
                  </Button>
                </div>
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
