import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getActiveSession } from '../../lib/api';
import { Html5QrcodePlugin } from '../../components/student/html5-qrcode-plugin';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, CheckCircle, QrCode, ClockIcon } from "lucide-react";
import { markAttendanceWithQR } from "@/lib/qrcode";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

// Define types for the data returned from API
interface AttendanceRecord {
  id: string;
  sessionId: string;
  userId: string;
  checkInTime: string;
  status: string;
}

interface Session {
  id: string;
  name: string;
  date: string;
  time: string;
  duration: number;
  expiresAt: string;
  isActive: boolean;
}

const StudentScannerPage: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanSuccess, setScanSuccess] = useState<boolean>(false);
  const [isExpired, setIsExpired] = useState(false);

  const [activeSession, setActiveSession] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Direct fetch function for active session using Supabase
  const fetchActiveSession = async () => {
    try {
      console.log('Scanner: Directly fetching active session using Supabase...');
      
      // Get the active session directly from Supabase
      const { data: session, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Scanner: Supabase error:', error);
        setActiveSession(null);
        return;
      }

      console.log('Scanner: Supabase active session result:', session);

      if (session) {
        // Check if session has expired
        const expiryTime = new Date(session.expires_at).getTime();
        const now = new Date().getTime();
        
        if (now > expiryTime) {
          console.log('Scanner: Session expired');
          setActiveSession(null);
          
          // Deactivate expired session
          await supabase
            .from('sessions')
            .update({ is_active: false })
            .eq('id', session.id);
            
          return;
        }
        
        console.log('Scanner: Active session found with ID:', session.id);
        
        // Update state with the active session
        setActiveSession(session);
        
        // Broadcast event for other components
        const event = new CustomEvent('active-session-updated', {
          detail: { session }
        });
        window.dispatchEvent(event);
      } else {
        console.log('Scanner: No active session found');
        setActiveSession(null);
      }
    } catch (error) {
      console.error('Scanner: Error fetching active session:', error);
      setActiveSession(null);
    }
  };

  // Set up polling for active session with more frequent checks
  useEffect(() => {
    console.log('Scanner: Setting up polling and Supabase subscriptions');
    
    // Initial fetch
    fetchActiveSession();
    
    // Set up Supabase realtime subscription for sessions table
    const subscription = supabase
      .channel('scanner-session-updates')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'sessions' }, 
        (payload) => {
          console.log('Scanner: Supabase realtime update received:', payload);
          
          // Check the payload for is_active status changes
          if (payload.new && payload.new.is_active === true) {
            console.log('Scanner: New active session detected, fetching immediately');
            fetchActiveSession();
          } else if (payload.old && payload.old.is_active === true) {
            console.log('Scanner: Previously active session changed, fetching immediately');
            fetchActiveSession();
          } else {
            console.log('Scanner: Session update, fetching to check if relevant');
            fetchActiveSession();
          }
        }
      )
      .subscribe((status) => {
        console.log('Scanner: Supabase subscription status:', status);
      });

    // Set up interval for polling as a fallback with more frequent checks
    const intervalId = setInterval(() => {
      console.log('Scanner: Polling for active session');
      fetchActiveSession();
    }, 3000); // Poll every 3 seconds for more responsiveness
    
    // Clean up interval and subscription on component unmount
    return () => {
      console.log('Scanner: Cleaning up polling and subscriptions');
      clearInterval(intervalId);
      supabase.removeChannel(subscription);
    };
  }, [queryClient]);

  // Log when active session changes
  useEffect(() => {
    console.log('Scanner: Active session state updated:', activeSession);
  }, [activeSession]);

  // Check if student is already checked in
  const { data: attendanceRecords } = useQuery<AttendanceRecord[]>({
    queryKey: ['/api/attendance/me'],
  });

  const isCheckedIn = attendanceRecords?.some(
    (record) => record.sessionId === activeSession?.id
  );

  useEffect(() => {
    console.log('Active session updated:', activeSession);
    if (activeSession) {
      setScanSuccess(isCheckedIn || false);
      setScanError(null);
      setIsExpired(false);
    }
  }, [activeSession, isCheckedIn]);

  const handleQrCodeScan = async (decodedText: string) => {
    try {
      console.log('Scanner: QR code detected:', decodedText);
      
      // Reset states
      setScanSuccess(false);
      setScanError(null);
      
      if (!activeSession) {
        setScanError('No active session found');
        return;
      }
      
      // Parse the QR data
      let qrData;
      try {
        qrData = JSON.parse(decodedText);
      } catch (error) {
        console.error('Scanner: Invalid QR code format:', error);
        setScanError('Invalid QR code format');
        return;
      }
      
      // Validate the QR data
      if (!qrData.sessionId) {
        console.error('Scanner: Invalid QR code data:', qrData);
        setScanError('Invalid QR code data');
        return;
      }
      
      // Check if the QR code is for the current active session
      if (qrData.sessionId !== activeSession.id) {
        console.error('Scanner: QR code session ID mismatch:', qrData.sessionId, activeSession.id);
        setScanError('This QR code is for a different session');
        return;
      }
      
      // Check if the QR code has expired
      const expiryTime = new Date(qrData.expires_at).getTime();
      const currentTime = Date.now();
      if (currentTime > expiryTime) {
        console.error('Scanner: QR code has expired');
        setScanError('This QR code has expired');
        return;
      }

      console.log('Scanner: Marking attendance for session:', qrData.sessionId);
      
      const response = await fetch(`http://localhost:3000/api/attendance/${qrData.sessionId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ 
          qrData: decodedText,
          sessionId: qrData.sessionId
        })
      });
      
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.error('Scanner: Non-JSON response:', contentType);
        setScanError('Server returned an invalid response');
        return;
      }
      
      const data = await response.json();
      console.log('Scanner: Attendance marking response:', data);
      
      if (!response.ok || !data.success) {
        console.error('Scanner: Error marking attendance:', data.message);
        setScanError(data.message || 'Failed to mark attendance');
        return;
      }
      
      console.log('Scanner: Attendance marked successfully');
      setScanSuccess(true);
      
      // Refresh the active session data
      fetchActiveSession();
      
    } catch (error) {
      console.error('Scanner: Error in QR code processing:', error);
      setScanError(error instanceof Error ? error.message : 'Failed to process QR code');
    }
  };

  // Add window focus and custom event handlers
  useEffect(() => {
    // Function to handle window focus events
    const handleWindowFocus = () => {
      console.log('Scanner: Window focused, refreshing active session');
      fetchActiveSession();
    };

    // Listen for the custom event from QR generator
    const handleSessionCreated = (event: any) => {
      console.log('Scanner: Received session-created event:', event.detail);
      fetchActiveSession();
    };

    // Set up event listeners
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('session-created', handleSessionCreated);

    // Clean up
    return () => {
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('session-created', handleSessionCreated);
    };
  }, []);

  // Add the useEffect for fetching on mount
  useEffect(() => {
    console.log('Scanner: Component mounted, fetching active session');
    fetchActiveSession();
    
    // Set up polling to periodically check for active sessions
    const interval = setInterval(() => {
      fetchActiveSession();
    }, 5000); // Every 5 seconds
    
    // Clean up on unmount
    return () => {
      clearInterval(interval);
    };
  }, []);

  if (!activeSession) {
    return (
      <div className="container mx-auto p-4">
        <div className="text-center py-8">
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
    <div className="container mx-auto px-4 py-6 space-y-6">
      <Card>
        <CardContent className="pt-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <QrCode className="mr-2 h-5 w-5 text-primary" />
            Scan QR Code
          </h3>
          <p className="text-muted-foreground mb-6">
            Scan the QR code displayed by your instructor to mark your attendance.
          </p>

          <div className="flex flex-col items-center">
            {isCheckedIn ? (
              <div className="w-full bg-green-50 dark:bg-green-900 p-4 rounded-md mb-4 flex items-start">
                <CheckCircle className="h-5 w-5 mr-2 text-green-500" />
                <div>
                  <p className="font-medium text-green-800 dark:text-green-200">Already checked in!</p>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    You have already marked your attendance for {activeSession?.name || "this session"}.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Fixed dimensions for QR scanner */}
                <div className="qr-scanner-container w-[300px] h-[300px] max-w-full mx-auto mb-4 relative">
                  <Html5QrcodePlugin 
                    fps={10}
                    qrbox={250}
                    disableFlip={false}
                    qrCodeSuccessCallback={handleQrCodeScan}
                  />
                </div>
              </>
            )}
          </div>

          {/* QR Scan Success Message */}
          {scanSuccess && !isCheckedIn && (
            <div className="mt-6 bg-green-50 dark:bg-green-900 p-4 rounded-md">
              <div className="flex items-start">
                <CheckCircle className="h-5 w-5 mr-2 text-green-500" />
                <div>
                  <p className="font-medium text-green-800 dark:text-green-200">Successfully checked in!</p>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    Your attendance has been recorded for this session.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* QR Scan Error Message */}
          {scanError && (
            <div className={`mt-6 ${isExpired ? 'bg-yellow-50 dark:bg-yellow-900' : 'bg-red-50 dark:bg-red-900'} p-4 rounded-md`}>
              <div className="flex items-start">
                {isExpired ? (
                  <ClockIcon className="h-5 w-5 mr-2 text-yellow-500" />
                ) : (
                  <AlertCircle className="h-5 w-5 mr-2 text-red-500" />
                )}
                <div>
                  <p className={`font-medium ${isExpired ? 'text-yellow-800 dark:text-yellow-200' : 'text-red-800 dark:text-red-200'}`}>
                    {isExpired ? 'QR Code Expired' : 'Error scanning QR code'}
                  </p>
                  <p className={`text-sm ${isExpired ? 'text-yellow-700 dark:text-yellow-300' : 'text-red-700 dark:text-red-300'}`}>
                    {scanError || "The QR code may be invalid or expired. Please try again or contact your instructor."}
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default StudentScannerPage;
