import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SimpleLink } from "@/components/ui/simple-link";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

// Type for active session
interface ActiveSession {
  id: string;
  name: string;
  date: string;
  time: string;
  duration: number;
  status: 'active' | 'completed' | 'inactive';
  attendance: number;
  total: number;
  is_active: boolean;
  expires_at: string;
  checked_in?: boolean;
  check_in_time?: string;
}

const StudentDashboard = () => {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [showWelcomeScreen, setShowWelcomeScreen] = useState(true);

  // Fetch active session
  const {
    data: activeSession,
    isLoading: sessionLoading,
    error: sessionError,
    refetch: refetchSession
  } = useQuery<ActiveSession>({
    queryKey: ['activeSession'],
    queryFn: async () => {
      console.log('Fetching active session...');
      try {
        // Add a delay to ensure auth is properly initialized
        if (!user) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        const response = await axios.get('/api/sessions/active', {
          withCredentials: true, // Ensure cookies are sent with the request
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });
        console.log('Active session response:', response.data);
        return response.data;
      } catch (error: any) {
        console.error('Error fetching active session:', error);
        
        // If we get a 401 error, try refreshing the auth status
        if (error.response && error.response.status === 401) {
          console.log('Authentication error, trying to refresh session...');
          try {
            // Force a refresh of the user session
            const meResponse = await axios.get('/api/me', { 
              withCredentials: true,
              headers: {
                'Cache-Control': 'no-cache'
              }
            });
            console.log('Session refreshed:', meResponse.data);
            
            // Retry fetching the active session
            const retryResponse = await axios.get('/api/sessions/active', { 
              withCredentials: true,
              headers: {
                'Cache-Control': 'no-cache'
              }
            });
            console.log('Retry active session response:', retryResponse.data);
            return retryResponse.data;
          } catch (retryError) {
            console.error('Failed to refresh session:', retryError);
            return null;
          }
        }
        
        return null;
      }
    },
    refetchInterval: 30000, // Refetch every 30 seconds
    retry: 2,
    enabled: !!user // Only run this query when user is available
  });

  // Fetch attendance history
  const {
    data: attendanceHistory,
    isLoading: historyLoading
  } = useQuery({
    queryKey: ['attendanceHistory'],
    queryFn: async () => {
      try {
        const response = await axios.get('/api/attendance/me', {
          withCredentials: true, // Ensure cookies are sent
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });
        console.log('Attendance history response:', response.data);
        return response.data;
      } catch (error) {
        console.error('Error fetching attendance history:', error);
        return [];
      }
    },
    refetchOnWindowFocus: false,
    retry: 1
  });

  // Dismiss welcome screen after 3 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowWelcomeScreen(false);
    }, 3000);
    
    return () => clearTimeout(timer);
  }, []);

  // Handle manual check-in
  const handleManualCheckIn = async () => {
    if (!activeSession?.id) {
      toast({
        title: "No Active Session",
        description: "There is currently no active session to check in to.",
        variant: "destructive"
      });
      return;
    }
    
    if (activeSession.checked_in) {
      toast({
        title: "Already Checked In",
        description: "You have already checked in to this session.",
        variant: "default"
      });
      return;
    }
    
    try {
      await axios.post(`/api/sessions/${activeSession.id}/attendance`, {
        userId: user?.id,
        timestamp: new Date().toISOString()
      });
      
      toast({
        title: "Checked In Successfully",
        description: "Your attendance has been recorded for this session.",
        variant: "success"
      });
      
      // Refresh the active session data
      refetchSession();
    } catch (error) {
      console.error('Error checking in:', error);
      toast({
        title: "Check-in Failed",
        description: "Failed to record your attendance. Please try again or scan the QR code.",
        variant: "destructive"
      });
    }
  };

  if (showWelcomeScreen) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
        <div className="w-full max-w-md text-center space-y-6">
          <h1 className="text-3xl font-bold text-foreground">Welcome Back{user ? ', ' + user.name : ''}!</h1>
          <p className="text-muted-foreground">Loading your dashboard...</p>
          <div className="w-full">
            <Progress value={60} className="h-1" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-8">
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Student Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {user?.name || 'Student'}. Track your attendance and upcoming sessions.
        </p>
      </div>

      {/* Active Session Card */}
      <Card className="overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
          <CardTitle className="text-xl font-bold">Active Session</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {sessionLoading ? (
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
            </div>
          ) : sessionError ? (
            <div className="text-center py-8">
              <p className="text-red-500">Error loading session data.</p>
              <Button onClick={() => refetchSession()} className="mt-2">Retry</Button>
            </div>
          ) : !activeSession || !activeSession.is_active ? (
            <div className="text-center py-8">
              <h3 className="text-lg font-semibold mb-2">No Active Session</h3>
              <p className="text-muted-foreground mb-4">
                There is currently no active session. Check back later.
              </p>
              <div className="mt-4">
                <Button 
                  variant="outline" 
                  onClick={() => refetchSession()}
                  className="text-primary border-primary hover:bg-primary/5"
                >
                  Check Again
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-bold">{activeSession.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {activeSession.date} • {activeSession.time} • {activeSession.duration} minutes
                </p>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium">
                  Session is active {activeSession.checked_in && " - You are checked in"}
                </span>
              </div>
              
              <div className="flex flex-wrap gap-4 mt-6">
                {activeSession.checked_in ? (
                  <Button variant="outline" disabled className="border-green-500 text-green-600">
                    ✓ Checked In
                  </Button>
                ) : (
                  <Button onClick={handleManualCheckIn}>
                    Check In Now
                  </Button>
                )}
                
                <SimpleLink to="/student/scanner">
                  <Button variant={activeSession.checked_in ? "outline" : "default"}>
                    Scan QR Code
                  </Button>
                </SimpleLink>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Attendance Stats Card */}
      <Card>
        <CardHeader>
          <CardTitle>Your Attendance</CardTitle>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
            </div>
          ) : !attendanceHistory || attendanceHistory.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-muted-foreground">No attendance records found.</p>
              <p className="text-sm text-muted-foreground mt-2">
                Your attendance will be recorded when you check into a session.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-primary/10">
                  <p className="text-sm text-muted-foreground">Present</p>
                  <p className="text-2xl font-bold">{attendanceHistory.filter(a => a.status === 'present').length}</p>
                </div>
                <div className="p-4 rounded-lg bg-destructive/10">
                  <p className="text-sm text-muted-foreground">Absent</p>
                  <p className="text-2xl font-bold">{attendanceHistory.filter(a => a.status === 'absent').length}</p>
                </div>
              </div>
              
              {attendanceHistory.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Attendance Rate</p>
                  <div className="relative pt-1">
                    <div className="overflow-hidden h-2 text-xs flex rounded bg-primary/20">
                      <div 
                        style={{ 
                          width: `${(attendanceHistory.filter(a => a.status === 'present').length / attendanceHistory.length) * 100}%` 
                        }} 
                        className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-primary"
                      ></div>
                    </div>
                  </div>
                  <p className="text-right text-sm mt-1">
                    {Math.round((attendanceHistory.filter(a => a.status === 'present').length / attendanceHistory.length) * 100)}%
                  </p>
                </div>
              )}
            </div>
          )}
          
          <div className="mt-6">
            <SimpleLink to="/student/attendance">
              <Button variant="outline" className="w-full">View Detailed Attendance History</Button>
            </SimpleLink>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StudentDashboard; 