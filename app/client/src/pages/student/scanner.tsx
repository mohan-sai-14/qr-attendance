import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from "@/lib/auth";
import { SimpleLink } from "@/components/ui/simple-link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ArrowLeft, ZoomIn, ZoomOut, Camera, CheckCircle2, RefreshCw, CameraOff, Undo } from 'lucide-react';
import { Loader2 } from "lucide-react";
import jsQR from 'jsqr';
import { useToast } from "@/components/ui/use-toast";
import { supabase } from '@/lib/supabase';

interface QRData {
  sessionId: string;
  name: string;
  date: string;
  time: string;
  duration: number;
  generatedAt: string;
  expiresAt: string;
}

// QR scanner component that uses the device camera and jsQR library
export default function StudentScanner() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [scanning, setScanning] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [selectedCamera, setSelectedCamera] = useState<string | null>(null);
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [hasCamera, setHasCamera] = useState(false);
  const scanIntervalRef = useRef<number>();
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(null);
  const streamRef = useRef(null);

  // Get available cameras
  useEffect(() => {
    const getAvailableCameras = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        setAvailableCameras(videoDevices);
        
        // Prefer rear camera on mobile
        const rearCamera = videoDevices.find(
          device => device.label.toLowerCase().includes('back') || device.label.toLowerCase().includes('rear')
        );
        
        if (rearCamera) {
          setSelectedCamera(rearCamera.deviceId);
        } else if (videoDevices.length > 0) {
          setSelectedCamera(videoDevices[0].deviceId);
        }
      } catch (err) {
        console.error('Error accessing cameras:', err);
        setError('Unable to access cameras. Please ensure camera permissions are granted.');
      }
    };
    
    getAvailableCameras();
    
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  // Start camera stream with selected camera
  useEffect(() => {
    const startStream = async () => {
      if (!selectedCamera || !scanning) return;
      
      try {
        // Stop any existing stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }
        
        const constraints = {
          video: {
            deviceId: selectedCamera ? { exact: selectedCamera } : undefined,
            facingMode: selectedCamera ? undefined : 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 },
            zoom: zoom,
          }
        };
        
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;
        setStream(stream);
        setHasCamera(true);
        setScanning(true);
        startScanning();
      } catch (err) {
        console.error('Error starting video stream:', err);
        setError('Failed to start camera. Please check your camera permissions.');
        setHasCamera(false);
      }
    };
    
    startStream();
  }, [selectedCamera, scanning, zoom]);

  // Function to detect QR codes from video stream
  const scanQRCode = () => {
    if (!canvasRef.current || !videoRef.current || !videoRef.current.readyState || videoRef.current.readyState !== 4) {
      rafRef.current = requestAnimationFrame(scanQRCode);
          return;
        }
        
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    const video = videoRef.current;
    
    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Draw current frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Get image data for QR code detection
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    
    // Detect QR code
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'dontInvert',
    });
    
    if (code) {
      console.log('QR code detected:', code.data);
      handleQRCode(code.data);
    } else {
      // If no QR code found, continue scanning
      rafRef.current = requestAnimationFrame(scanQRCode);
    }
  };

  // Handle the scanned QR code data
  const handleQRCode = async (qrData: string) => {
    if (loading) return; // Prevent multiple submissions
    
    try {
      console.log('Processing QR code:', qrData);
      setLoading(true);
      
      const parsedData: QRData = JSON.parse(qrData);
      
      // Check if QR code has expired
      if (new Date(parsedData.expiresAt) < new Date()) {
        toast({
          variant: "destructive",
          title: "QR Code Expired",
          description: "This QR code has expired. Please ask for a new one.",
        });
        return;
      }

      // Check if session exists and is active
      const { data: session, error: sessionError } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', parsedData.sessionId)
        .eq('is_active', true)
        .single();

      if (sessionError || !session) {
        toast({
          variant: "destructive",
          title: "Invalid Session",
          description: "This QR code is not valid for any active session.",
        });
        return;
      }

      // Check if attendance already recorded
      const { data: existingAttendance, error: attendanceError } = await supabase
        .from('attendance')
        .select('*')
        .eq('session_id', parsedData.sessionId)
        .eq('user_id', user?.id)
        .single();

      if (existingAttendance) {
        toast({
          title: "Already Recorded",
          description: "Your attendance for this session has already been recorded.",
        });
        return;
      }

      // Record attendance
      const { error: insertError } = await supabase
        .from('attendance')
        .insert([{
          session_id: parsedData.sessionId,
          user_id: user?.id,
          timestamp: new Date().toISOString(),
          status: 'present'
        }]);

      if (insertError) {
        throw new Error('Failed to record attendance');
      }

      toast({
        title: "Success!",
        description: "Your attendance has been recorded successfully.",
      });

      // Stop scanning after successful attendance
      stopCamera();
    } catch (err) {
      console.error('Error processing QR code:', err);
      setError(err.message || 'Unknown error occurred');
      setScanning(false);
    } finally {
      setLoading(false);
    }
  };

  // Zoom functions
  const increaseZoom = () => {
    setZoom(prev => Math.min(prev + 0.25, 3));
  };

  const decreaseZoom = () => {
    setZoom(prev => Math.max(prev - 0.25, 1));
  };

  // Switch camera
  const switchCamera = () => {
    if (availableCameras.length <= 1) return;
    
    const currentIndex = availableCameras.findIndex(camera => camera.deviceId === selectedCamera);
    const nextIndex = (currentIndex + 1) % availableCameras.length;
    setSelectedCamera(availableCameras[nextIndex].deviceId);
  };

  // Reset scanner state
  const resetScanner = () => {
    setError(null);
    setSuccess(false);
    setMessage('');
    setScanning(true);
  };

  const startScanning = () => {
    if (!canvasRef.current || !videoRef.current) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const context = canvas.getContext('2d');
    if (!context) return;

    scanIntervalRef.current = window.setInterval(() => {
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.height = video.videoHeight;
        canvas.width = video.videoWidth;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "dontInvert",
        });

        if (code) {
          handleQRCode(code.data);
        }
      }
    }, 100);
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
    }
    setScanning(false);
  };

  const toggleZoom = (increase: boolean) => {
    setZoom(prev => {
      const newZoom = increase ? prev * 1.2 : prev / 1.2;
      return Math.max(1, Math.min(newZoom, 5));
    });
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-md">
      <div className="mb-6 flex items-center justify-between">
        <SimpleLink to="/student" className="text-foreground/80 hover:text-foreground flex items-center">
          <ArrowLeft className="h-5 w-5 mr-1" />
          <span>Back to Dashboard</span>
        </SimpleLink>
      </div>
      
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Scan Attendance QR Code</CardTitle>
          <CardDescription>
            Scan the QR code shown by your instructor to mark your attendance
          </CardDescription>
        </CardHeader>
        
        <CardContent className="p-0 relative">
          {scanning ? (
            <div className="relative">
              <div className="qr-scanner-container relative overflow-hidden h-[350px] bg-black">
                <video 
                  ref={videoRef} 
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{ 
                    transform: `scale(${zoom})`,
                    transformOrigin: 'center'
                  }}
                />
                {/* Hidden canvas for QR processing */}
                <canvas 
                  ref={canvasRef}
                  className="hidden"
                ></canvas>
                
                {/* Scanner overlay with scanner animation */}
                <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                  <div className="w-[80%] h-[80%] max-w-[250px] max-h-[250px] border-2 border-white/50 rounded-lg relative overflow-hidden">
                    {/* Scanning animation line */}
                    <div className="absolute top-0 left-0 right-0 h-[2px] bg-green-500 animate-scan"></div>
        </div>
                </div>
                
                {/* Camera controls */}
                <div className="absolute bottom-4 right-4 flex flex-col gap-2 z-20">
                  <Button 
                    variant="secondary" 
                    size="icon" 
                    className="rounded-full bg-background/80 backdrop-blur-sm"
                    onClick={increaseZoom}
                    disabled={zoom >= 3}
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="secondary" 
                    size="icon" 
                    className="rounded-full bg-background/80 backdrop-blur-sm"
                    onClick={decreaseZoom}
                    disabled={zoom <= 1}
                  >
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  {availableCameras.length > 1 && (
                    <Button 
                      variant="secondary" 
                      size="icon" 
                      className="rounded-full bg-background/80 backdrop-blur-sm"
                      onClick={switchCamera}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  )}
              </div>
                
                {loading && (
                  <div className="absolute inset-0 bg-background/80 backdrop-blur-md flex items-center justify-center z-30">
                    <div className="text-center">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
                      <p className="font-medium text-lg">{message || 'Processing...'}</p>
                    </div>
                      </div>
                )}
                      </div>
                      
              <div className="py-4 px-6">
                <h3 className="text-sm font-semibold mb-2">Instructions:</h3>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li className="flex items-start">
                    <span className="mr-2 text-primary">1.</span>
                    Position the QR code within the scanning frame
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2 text-primary">2.</span>
                    Hold your device steady until the QR code is detected
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2 text-primary">3.</span>
                    Use zoom controls if the QR code is too small or far away
                  </li>
                  {availableCameras.length > 1 && (
                    <li className="flex items-start">
                      <span className="mr-2 text-primary">4.</span>
                      Use the camera switch button if needed
                    </li>
                  )}
                </ul>
                      </div>
                    </div>
          ) : (
            <div className="p-6 space-y-6">
              {error ? (
                <Alert variant="destructive" className="mb-4">
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : success ? (
                <div className="text-center py-6">
                  <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-2 text-green-500">Attendance Recorded!</h3>
                  <p className="text-muted-foreground mb-6">{message}</p>
                  <p className="text-sm text-muted-foreground">Redirecting you to the dashboard...</p>
                        </div>
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

      <style jsx global>{`
        @keyframes scan {
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
        .animate-scan {
          animation: scan 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
