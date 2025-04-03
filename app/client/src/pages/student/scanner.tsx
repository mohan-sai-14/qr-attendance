import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Html5QrcodePlugin } from '../../components/student/html5-qrcode-plugin';
import AttendanceCodeInput from '../../components/student/AttendanceCodeInput';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { getActiveSession, recordAttendance } from "@/lib/api";
import { createClient } from '@supabase/supabase-js';
import { useToast } from "@/hooks/use-toast";

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

const StudentScannerPage: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isScanning, setIsScanning] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [success, setSuccess] = useState(false);
  const [redirectUrl, setRedirectUrl] = useState('');
  const [activeSession, setActiveSession] = useState<AttendanceRecord | null>(null);

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

  const handleQrCodeSuccess = async (decodedText: string) => {
    try {
      setIsLoading(true);
      setErrorMessage('');
      setIsScanning(false); // Stop scanning immediately after a successful scan
      
      console.log("Raw QR code data:", decodedText);
      
      let sessionData;
      try {
        // Try to parse the QR code data as JSON
        sessionData = JSON.parse(decodedText);
        console.log("Decoded QR code data:", sessionData);
        
        if (!sessionData.sessionId) {
          throw new Error('Invalid QR code format: missing session ID');
        }
        
        // Get current user information from auth context
        if (!user) {
          setErrorMessage('User not authenticated. Please log in again.');
          return;
        }
        
        console.log("QR Session ID found:", sessionData.sessionId);
        console.log("User information:", user);
        
        // Get the active session directly from Supabase
        const { data: sessions, error: sessionsError } = await supabase
          .from('sessions')
          .select('*')
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(1);
          
        if (sessionsError) {
          console.error("Error fetching active session:", sessionsError);
          setErrorMessage('Error accessing session data. Please try again.');
          return;
        }
        
        if (!sessions || sessions.length === 0) {
          setErrorMessage('No active session found. Please try again later.');
          return;
        }
        
        const activeSessionData = sessions[0];
        console.log("Active session in database:", activeSessionData);
        
        // Format the current date/time
        const now = new Date();
        
        // Format date in DD-MM-YYYY format for the date column
        const dateString = String(now.getDate()).padStart(2, '0') + '-' + 
                          String(now.getMonth() + 1).padStart(2, '0') + '-' + 
                          now.getFullYear();
        
        // Format timestamp in database-friendly format (YYYY-MM-DD HH:MM:SS)
        const localTimestamp = now.getFullYear() + '-' + 
                             String(now.getMonth() + 1).padStart(2, '0') + '-' + 
                             String(now.getDate()).padStart(2, '0') + ' ' + 
                             String(now.getHours()).padStart(2, '0') + ':' + 
                             String(now.getMinutes()).padStart(2, '0') + ':' + 
                             String(now.getSeconds()).padStart(2, '0');
        
        console.log("Using timestamp:", localTimestamp);
        console.log("Using date:", dateString);
        
        // Check if attendance has already been recorded
        const { data: existingAttendance, error: checkError } = await supabase
          .from('attendance')
          .select('*')
          .eq('user_id', user.username)
          .eq('session_id', activeSessionData.id)
          .single();
          
        if (checkError && checkError.code !== 'PGRST116') { // Code PGRST116 means no rows returned
          console.error("Error checking attendance:", checkError);
        }
        
        if (existingAttendance) {
          console.log("Attendance already recorded for this session");
          setSuccess(true);
          setErrorMessage(''); // Clear any previous error messages
          setRedirectUrl('/student/dashboard');
          
          // Show specific message for already recorded attendance
          toast({
            title: "Already Recorded",
            description: "Your attendance for this session was already recorded.",
            duration: 5000
          });
          
          return;
        }
        
        // Insert attendance record into Supabase
        const { data: attendanceData, error: insertError } = await supabase
          .from('attendance')
          .insert([{
            user_id: user.username,
            session_id: activeSessionData.id,
            check_in_time: localTimestamp,
            date: dateString,
            status: 'present',
            name: user.name || 'Student',
            session_name: activeSessionData.name
          }])
          .select();
          
        if (insertError) {
          console.error("Error recording attendance:", insertError);
          
          // Check if error is due to duplicate record (should be caught by prior check)
          if (insertError.code === '23505') {
            console.log("Attendance already recorded (duplicate record)");
            setSuccess(true);
            setErrorMessage(''); // Clear any previous error messages
            setRedirectUrl('/student/dashboard');
            
            // Show specific message for already recorded attendance
            toast({
              title: "Already Recorded",
              description: "Your attendance for this session was already recorded.",
              duration: 5000
            });
            
            return;
          }
          
          setErrorMessage('Failed to record attendance: ' + insertError.message);
          return;
        }
        
        console.log("Attendance recorded successfully:", attendanceData);
        setSuccess(true);
        setRedirectUrl('/student/dashboard');
        
      } catch (e) {
        console.error("QR code parse error:", e);
        setErrorMessage('Invalid QR code format. Please try again or use the code entry method.');
        return;
      }
    } catch (error: any) {
      console.error('Error processing QR code:', error);
      setErrorMessage('Failed to process QR code. Please try again or use the code entry option.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleScanAgain = () => {
    setIsScanning(true);
    setErrorMessage('');
    setSuccess(false);
  };

  // Session code fetching
  const { data: sessionCode } = useQuery({
    queryKey: ['sessionCode', activeSession?.id],
    queryFn: async () => {
      if (!activeSession?.id) return null;
      try {
        const response = await axios.get(`/api/sessions/code/${activeSession.id}`);
        return response.data.attendanceCode;
      } catch (error) {
        console.error('Error fetching session code:', error);
        return null;
      }
    },
    enabled: !!activeSession?.id,
    retry: false,
  });

  if (activeSession === null) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4 p-5 max-w-md text-center">
          <h2 className="text-2xl font-bold text-red-500 mb-4">No Active Session Found</h2>
          <p className="text-gray-600 mb-4">
            There is currently no active attendance session. Please try again when a session is active.
          </p>
          <Button onClick={() => window.location.href = '/student'}>
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      {!activeSession ? (
        <div className="text-center py-8">
          <h2 className="text-2xl font-bold text-red-500 mb-4">No Active Session Found</h2>
          <p className="text-gray-600 mb-4">
            There is currently no active attendance session. Please try again when a session is active.
          </p>
          <Button onClick={() => window.location.href = '/student'}>
            Return to Dashboard
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-center">
            Record Your Attendance
          </h2>
          
          <Card className="shadow-md">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold">{activeSession.name}</h3>
                  <p className="text-sm text-gray-600">
                    {activeSession.date} • {activeSession.time}
                  </p>
                </div>
                
                <Badge 
                  variant="outline" 
                  className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                >
                  Active Session
                </Badge>
              </div>

              <Tabs defaultValue="scan" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="scan">Scan QR Code</TabsTrigger>
                  <TabsTrigger value="code">Enter Code</TabsTrigger>
                </TabsList>
                
                <TabsContent value="scan" className="pt-4">
                  {success ? (
                    <div className="flex flex-col items-center justify-center p-4 text-center space-y-6">
                      <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
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
                        <h3 className="text-xl font-bold text-green-600 mb-2">Attendance Recorded!</h3>
                        <p className="text-gray-600 mb-4">
                          Your attendance has been successfully recorded for this session.
                        </p>
                      </div>
                      
                      <div className="space-x-4">
                        <Button onClick={() => setRedirectUrl('/student/dashboard')}>
                          Go to Dashboard
                        </Button>
                        <Button variant="outline" onClick={() => {
                          setSuccess(false);
                          setIsScanning(true);
                          setErrorMessage('');
                        }}>
                          Scan Again
                        </Button>
                      </div>
                    </div>
                  ) : isLoading ? (
                    <div className="flex flex-col items-center justify-center p-8 space-y-4">
                      <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-primary font-medium">Recording attendance...</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {isScanning ? (
                        <div>
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
                      ) : (
                        <div className="flex flex-col items-center justify-center py-4">
                          <Button className="mb-2" onClick={handleScanAgain}>
                            Scan Again
                          </Button>
                          <p className="text-sm text-gray-500">Scan was paused. Click to resume.</p>
                        </div>
                      )}
                      
                      {errorMessage && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-600 text-sm">
                          {errorMessage}
                        </div>
                      )}
                      
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                        <h4 className="font-medium text-blue-700 mb-1">Instructions:</h4>
                        <ol className="text-sm text-blue-600 list-decimal list-inside space-y-1">
                          <li>Position your camera to face the QR code displayed by your instructor</li>
                          <li>Ensure there's good lighting and hold your device steady</li>
                          <li>Wait for the QR code to be recognized</li>
                          <li>Your attendance will be recorded automatically</li>
                        </ol>
                      </div>
                    </div>
                  )}
                </TabsContent>
                
                <TabsContent value="code" className="pt-4">
                  <AttendanceCodeInput />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      )}
      
      {redirectUrl && (
        <div className="fixed bottom-4 right-4 flex items-center bg-primary text-white p-3 rounded-lg shadow-lg">
          <span className="mr-2">Redirecting to dashboard...</span>
          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
    </div>
  );
};

export default StudentScannerPage;
