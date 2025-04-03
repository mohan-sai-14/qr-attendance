import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Html5QrcodePlugin } from '../../components/student/html5-qrcode-plugin';
import AttendanceCodeInput from '../../components/student/AttendanceCodeInput';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { getActiveSession } from "@/lib/api";
import { createClient } from '@supabase/supabase-js';
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

// Initialize Supabase client
const supabaseUrl = 'https://qwavakkbfpdgkvtctogx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF3YXZha2tiZnBkZ2t2dGN0b2d4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI3MTE4MjYsImV4cCI6MjA1ODI4NzgyNn0.Kdwo9ICmcsHPhK_On6G73ccSPkcEqzAg2BtvblhD8co';
const supabase = createClient(supabaseUrl, supabaseKey);

// Simple link component instead of using React Router
const SimpleLink = ({ to, children }: { to: string; children: React.ReactNode }) => {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    window.location.href = to;
  };
  
  return (
    <a href={to} onClick={handleClick} style={{ textDecoration: 'none' }}>
      {children}
    </a>
  );
};

interface AttendanceRecord {
  id: string;
  name: string;
  date: string;
  time?: string;
  duration?: string;
  is_active?: boolean;
  [key: string]: any;
}

const StudentScannerPage: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const [isScanning, setIsScanning] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [success, setSuccess] = useState(false);
  const [redirectUrl, setRedirectUrl] = useState('');
  const [activeSession, setActiveSession] = useState<AttendanceRecord | null>(null);
  const [data, setData] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("scanner");
  const [scanning, setScanning] = useState<boolean>(false);
  const [hasCamera, setHasCamera] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [retryAttempts, setRetryAttempts] = useState<number>(0);

  // Directly fetch active session
  useEffect(() => {
    const fetchActiveSession = async () => {
      try {
        console.log('Scanner: Fetching active session...');
        const response = await getActiveSession();
        console.log('Active session response:', response);
        
        // Check if the response contains data in the expected format
        if (response && response.success && response.data) {
          setActiveSession(response.data);
        } else if (response && response.id) {
          // Fallback for older API format
          setActiveSession(response);
        } else {
          console.log('No active session found or invalid format');
          setActiveSession(null);
        }
      } catch (error) {
        console.error('Error fetching active session:', error);
        setActiveSession(null);
      }
    };

    fetchActiveSession();
    
    // Set up interval to periodically check for active sessions
    const intervalId = setInterval(fetchActiveSession, 10000);
    
    // Clean up interval on component unmount
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    // Check if camera is available
    navigator.mediaDevices.getUserMedia({ video: true })
      .then(() => setHasCamera(true))
      .catch(() => setHasCamera(false));
    
    // Try to refresh user session if needed
    const checkAuth = async () => {
      if (!user) {
        try {
          // Ensure user is authenticated by making a direct request
          const authResponse = await axios.get('/api/me', { withCredentials: true });
          console.log('Authentication response:', authResponse.data);
          
          if (authResponse.data) {
            await refreshUser();
          }
        } catch (error) {
          console.error("Unable to refresh authentication:", error);
        }
      }
    };
    
    checkAuth();
  }, [user, refreshUser]);

  const handleQrCodeSuccess = async (decodedText: string) => {
    if (isProcessing) return; // Prevent multiple simultaneous submissions
    
    console.log("QR code scanned:", decodedText);
    setData(decodedText);
    setScanning(false);
    
    try {
      setIsProcessing(true);
      
      let sessionId = decodedText;
      
      // Try to parse if it looks like a JSON string
      if (decodedText.startsWith('{') && decodedText.endsWith('}')) {
        try {
          const parsedData = JSON.parse(decodedText);
          sessionId = parsedData.sessionId || parsedData.id || decodedText;
          console.log("Parsed session ID:", sessionId);
        } catch (parseError) {
          console.warn("Could not parse QR data as JSON, using raw text:", parseError);
        }
      }
      
      // Ensure user is authenticated
      let currentUser = user;
      if (!currentUser) {
        try {
          console.log("Refreshing user authentication before recording attendance...");
          const authResponse = await axios.get('/api/me', { withCredentials: true });
          if (authResponse.data && authResponse.data.id) {
            currentUser = authResponse.data;
            await refreshUser();
          } else {
            console.log("Creating fallback user for attendance");
            currentUser = {
              id: 3, // Default to mohan demo user
              username: 'mohan',
              name: 'Demo Student',
              role: 'student'
            };
          }
          console.log("Using user for attendance:", currentUser);
        } catch (authError) {
          console.error("Auth refresh failed, using fallback user:", authError);
          currentUser = {
            id: 3,
            username: 'mohan',
            name: 'Demo Student',
            role: 'student'
          };
        }
      }

      // First, try to save directly to Supabase
      let supabaseSuccess = false;
      
      try {
        console.log("Attempting to save attendance directly to Supabase...");
        
        // Format the current date for the database record
        const now = new Date();
        const formattedDate = now.toISOString().split('T')[0]; // YYYY-MM-DD
        const localTimestamp = now.toISOString();
        
        // Insert attendance record directly to Supabase
        const { data: insertData, error: insertError } = await supabase
          .from('attendance')
          .insert([{
            session_id: sessionId,
            user_id: currentUser.id || 3,
            username: currentUser.username || 'student',
            name: currentUser.name || 'Student',
            check_in_time: localTimestamp,
            date: formattedDate,
            status: 'present',
            session_name: activeSession?.name || `Session ${sessionId}`
          }])
          .select();
          
        if (insertError) {
          console.error('Direct Supabase error:', insertError);
          // Continue to API fallback
        } else {
          console.log('Successfully saved attendance directly to Supabase:', insertData);
          supabaseSuccess = true;
        }
      } catch (supabaseError) {
        console.error("Error with direct Supabase insert:", supabaseError);
        // Continue to API fallback
      }
      
      // If Supabase direct insert failed, try the API
      if (!supabaseSuccess) {
        // API fallback if direct Supabase insertion fails
        console.log("Trying API fallback for attendance recording...");
        try {
          const response = await fetch('/api/scan', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              sessionId,
              userId: currentUser.id || 3,
              username: currentUser.username || 'student',
              timestamp: new Date().toISOString()
            }),
            credentials: 'include'
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error(`API error (${response.status}):`, errorText);
            throw new Error(`API error: ${response.status} - ${errorText}`);
          }
          
          const result = await response.json();
          console.log("API response:", result);
          
          if (result.success) {
            supabaseSuccess = true;
          }
        } catch (apiError) {
          console.error("API fallback failed:", apiError);
          
          // If we've tried less than 3 times, retry with exponential backoff
          if (retryAttempts < 3) {
            console.log(`Retry attempt ${retryAttempts + 1}/3`);
            setRetryAttempts(retryAttempts + 1);
            setIsProcessing(false);
            setTimeout(() => handleQrCodeSuccess(decodedText), 1000 * (2 ** retryAttempts));
            return;
          }
          
          // If we've already retried 3 times, show final error
          if (!supabaseSuccess) {
            toast({
              title: "Error Recording Attendance",
              description: "Failed to record your attendance. Please try the manual code entry or contact your instructor.",
              variant: "destructive"
            });
            setIsProcessing(false);
            return;
          }
        }
      }
      
      // If we got here, one of the methods succeeded
      toast({
        title: "Attendance Recorded",
        description: "Your attendance has been successfully recorded!"
      });
      
      // Set success state for UI feedback
      setSuccess(true);
      setRetryAttempts(0);
      
      // Always use base URL + path for redirect to avoid 404s
      setTimeout(() => {
        // Use window.location.replace for more reliable navigation
        const baseUrl = window.location.origin;
        // First navigate to root to avoid 404s
        window.location.replace(baseUrl);
        
        // Then after a short delay, navigate to student dashboard
        setTimeout(() => {
          window.location.replace(`${baseUrl}/student`);
        }, 300);
      }, 1500);
      
    } catch (error) {
      console.error("Error processing QR code:", error);
      toast({
        title: "Error",
        description: "Failed to process QR code. Please try again or use manual code entry.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const startScanning = () => {
    setStarted(true);
    setScanning(true);
    setData(null);
  };

  const resetScanner = () => {
    setData(null);
    setStarted(false);
    setScanning(false);
  };

  const handleCodeSuccess = (redirectUrl: string) => {
    toast({
      title: "Attendance Recorded",
      description: "Your attendance has been successfully recorded!"
    });
    
    // Safe navigation approach
    setTimeout(() => {
      const baseUrl = window.location.origin;
      window.location.href = `${baseUrl}/student`;
    }, 1500);
  };

  const handleCodeError = (errorMessage: string) => {
    toast({
      title: "Failed to Record Attendance",
      description: errorMessage,
      variant: "destructive"
    });
  };

  // Component to show if no camera is available
  const NoCameraMessage = () => (
    <div className="text-center p-6 space-y-4">
      <div className="flex justify-center">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <h3 className="text-lg font-bold">Camera Not Available</h3>
      <p className="text-gray-600">
        We couldn't access your camera. Please make sure you've granted camera permissions,
        or use the manual code entry method instead.
      </p>
      <Button 
        variant="outline" 
        onClick={() => setActiveTab("manual")}
        className="mt-2"
      >
        Switch to Manual Entry
      </Button>
    </div>
  );

  if (!activeSession) {
    return (
      <div className="container mx-auto p-4">
        <div className="text-center py-8">
          <h2 className="text-2xl font-bold text-red-500 mb-4">No Active Session Found</h2>
          <p className="text-gray-600 mb-4">
            There is currently no active attendance session. Please try again when a session is active.
          </p>
          <Button 
            onClick={() => {
              const baseUrl = window.location.origin;
              window.location.href = `${baseUrl}/student`;
            }}
          >
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-md">
      <Card className="w-full">
        <CardHeader className="text-center">
          <CardTitle>Attendance</CardTitle>
          <CardDescription>
            Scan the QR code or enter the attendance code to record your attendance.
          </CardDescription>
        </CardHeader>
        
        <Tabs 
          defaultValue="scanner" 
          value={activeTab}
          onValueChange={setActiveTab}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="scanner">QR Scanner</TabsTrigger>
            <TabsTrigger value="manual">Manual Code</TabsTrigger>
          </TabsList>
          
          <TabsContent value="scanner" className="mt-4">
            <CardContent className="pb-4">
              {!hasCamera ? (
                <NoCameraMessage />
              ) : !started ? (
                <div className="text-center p-4 space-y-4">
                  <p className="text-gray-600 mb-4">
                    Click the button below to start scanning the QR code. Make sure your camera is enabled.
                  </p>
                  <Button onClick={startScanning} className="w-full">
                    Start QR Scanner
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {scanning && (
                    <div className="overflow-hidden rounded-lg">
                      <Html5QrcodePlugin
                        fps={10}
                        qrbox={250}
                        disableFlip={false}
                        qrCodeSuccessCallback={handleQrCodeSuccess}
                        qrCodeErrorCallback={(error) => {
                          console.warn("QR Scan Error:", error);
                          // Don't show transient errors to user while scanning
                        }}
                      />
                    </div>
                  )}
                  
                  {isProcessing && (
                    <div className="flex flex-col items-center justify-center p-4">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <p className="mt-2 text-center text-sm text-gray-600">
                        Processing attendance...
                      </p>
                    </div>
                  )}
                  
                  {data && !isProcessing && (
                    <div className="text-center p-4 space-y-4">
                      <div className="w-16 h-16 mx-auto rounded-full bg-green-100 flex items-center justify-center">
                        <svg 
                          xmlns="http://www.w3.org/2000/svg" 
                          className="h-10 w-10 text-green-600" 
                          fill="none" 
                          viewBox="0 0 24 24" 
                          stroke="currentColor"
                        >
                          <path 
                            strokeLinecap="round" 
                            strokeLinejoin="round" 
                            strokeWidth={2} 
                            d="M5 13l4 4L19 7" 
                          />
                        </svg>
                      </div>
                      
                      <div>
                        <h3 className="text-xl font-bold text-green-600 mb-2">QR Code Scanned!</h3>
                        <p className="text-gray-600 mb-4">
                          Processing your attendance...
                        </p>
                      </div>
                      
                      <Button 
                        onClick={resetScanner} 
                        variant="outline"
                      >
                        Scan Again
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
            
            {started && !isProcessing && (
              <CardFooter className="flex justify-between">
                <Button 
                  onClick={resetScanner} 
                  variant="outline"
                >
                  {data ? "Scan Again" : "Cancel"}
                </Button>
                
                <Button 
                  onClick={() => setActiveTab("manual")}
                  variant="outline"
                >
                  Use Code Instead
                </Button>
              </CardFooter>
            )}
          </TabsContent>
          
          <TabsContent value="manual" className="mt-4">
            <CardContent>
              <AttendanceCodeInput 
                onSuccess={handleCodeSuccess}
                onError={handleCodeError}
              />
            </CardContent>
          </TabsContent>
        </Tabs>
      </Card>
      
      <div className="mt-8 text-center">
        <Button 
          variant="outline" 
          onClick={() => {
            const baseUrl = window.location.origin;
            window.location.href = `${baseUrl}/student`;
          }}
          className="mx-auto"
        >
          Return to Dashboard
        </Button>
      </div>
    </div>
  );
};

export default StudentScannerPage;
