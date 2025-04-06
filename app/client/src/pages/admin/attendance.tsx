import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { exportAttendanceToExcel } from "@/lib/excel";
import { Download, QrCode as QrCodeIcon, PlusCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { QRCodeSVG } from "qrcode.react";
import QRCode from "qrcode";
import { supabase } from "@/lib/supabase";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AttendanceRecord } from "@/types";
import { toast } from "@/components/ui/use-toast";
import { createClient } from '@supabase/supabase-js';
import { isQRCodeExpired, getQRCodeTimeRemaining, setupSessionExpirationHandler } from "@/lib/qrcode";

// Initialize Supabase
const supabaseUrl = 'https://qwavakkbfpdgkvtctogx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF3YXZha2tiZnBkZ2t2dGN0b2d4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI3MTE4MjYsImV4cCI6MjA1ODI4NzgyNn0.Kdwo9ICmcsHPhK_On6G73ccSPkcEqzAg2BtvblhD8co';
const supabase = createClient(supabaseUrl, supabaseKey);

export default function Attendance() {
  const [sessionFilter, setSessionFilter] = useState<string>("all");
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [qrCodeData, setQrCodeData] = useState<string>('');
  const [activeSession, setActiveSession] = useState<AttendanceRecord | null>(null);
  const [sessionStats, setSessionStats] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [sessionName, setSessionName] = useState<string>("");
  const [sessionDate, setSessionDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [sessionTime, setSessionTime] = useState<string>("");
  const [sessionDuration, setSessionDuration] = useState<string>("60");
  const [timeRemaining, setTimeRemaining] = useState<string>("0:00");
  const [expirationIntervalId, setExpirationIntervalId] = useState<any>(null);
  const sessionExpirationTimeout = useRef<NodeJS.Timeout | null>(null);

  // Fetch all sessions and students
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        
        // Fetch all sessions
        const { data: sessions, error: sessionsError } = await supabase
          .from('sessions')
          .select('*')
          .order('created_at', { ascending: false });
          
        if (sessionsError) throw sessionsError;
        
        // Fetch active session
        const { data: activeSessions, error: activeSessionError } = await supabase
          .from('sessions')
          .select('*')
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(1);
          
        if (activeSessionError) throw activeSessionError;
        
        const activeSessionData = activeSessions && activeSessions.length > 0 ? activeSessions[0] : null;
        setActiveSession(activeSessionData);
        
        // If we have an active session, generate QR code
        if (activeSessionData) {
          generateQRCode(activeSessionData);
        }
        
        // Fetch student count
        const { count: studentsCount, error: studentsError } = await supabase
          .from('users')
          .select('*', { count: 'exact', head: true })
          .eq('role', 'student');
          
        if (studentsError) throw studentsError;
        
        // Fetch attendance stats for each session
        const sessionsWithStats = await Promise.all(
          (sessions || []).map(async (session) => {
            try {
              // Get attendance for this session
              const { data: attendance, error: attendanceError } = await supabase
                .from('attendance')
                .select('*')
                .eq('session_id', session.id);
                
              if (attendanceError) throw attendanceError;
              
              const presentCount = attendance ? attendance.length : 0;
              const absentCount = studentsCount ? studentsCount - presentCount : 0;
              const attendanceRate = studentsCount ? Math.round((presentCount / studentsCount) * 100) : 0;
              
              return {
                ...session,
                present: presentCount,
                absent: absentCount,
                percentage: `${attendanceRate}%`
              };
            } catch (error) {
              console.error(`Error fetching attendance for session ${session.id}:`, error);
              return {
                ...session,
                present: 0,
                absent: 0,
                percentage: '0%'
              };
            }
          })
        );
        
        setSessionStats(sessionsWithStats);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
    
    // Set up polling
    const interval = setInterval(fetchData, 10000);
    
    return () => clearInterval(interval);
  }, []);

  // Calculate overall statistics
  const overallStats = useMemo(() => {
    if (!sessionStats.length) return { averageAttendance: '-', perfectAttendance: '-' };
    
    // Calculate average attendance rate
    const attendanceRates = sessionStats.map(s => 
      parseInt(s.percentage.replace('%', '')) || 0
    );
    const averageRate = attendanceRates.length 
      ? Math.round(attendanceRates.reduce((a, b) => a + b, 0) / attendanceRates.length) 
      : 0;
      
    // Placeholder for perfect attendance
    const perfectCount = 0;
    
    return {
      averageAttendance: `${averageRate}%`,
      perfectAttendance: perfectCount.toString()
    };
  }, [sessionStats]);

  // Generate QR code for active session
  const generateQRCode = async (session: AttendanceRecord) => {
    try {
      const sessionData = {
        sessionId: session.id,
        name: session.name,
        date: session.date,
        time: session.time,
        duration: session.duration,
        generatedAt: new Date().toISOString(),
        expiresAfter: session.duration,
        expiresAt: session.expires_at
      };
      
      const qrCodeContent = JSON.stringify(sessionData);
      setQrCodeData(qrCodeContent);
      
      const qrCodeDataUrl = await QRCode.toDataURL(qrCodeContent);
      setQrCodeUrl(qrCodeDataUrl);
    } catch (error: unknown) {
      console.error("Error generating QR code:", error);
    }
  };

  // Create a new session
  const handleCreateSession = async () => {
    try {
      if (!sessionName || !sessionDate || !sessionTime) {
        alert("Please fill in all required fields");
        return;
      }
      
      const now = new Date();
      const duration = parseInt(sessionDuration) || 60;
      
      // Calculate expiration time
      const expiryTime = new Date(now.getTime() + duration * 60000);
      
      // Deactivate any currently active sessions
      if (activeSession) {
        await supabase
          .from('sessions')
          .update({ is_active: false })
          .eq('id', activeSession.id);
      }
      
      // Create QR code data
      const sessionId = crypto.randomUUID();
      const qrData = {
        sessionId,
        name: sessionName,
        date: sessionDate,
        time: sessionTime,
        duration,
        generatedAt: now.toISOString(),
        expiresAfter: duration,
        expiresAt: expiryTime.toISOString()
      };
      
      // Insert new session
      const { data, error } = await supabase
        .from('sessions')
        .insert({
          id: sessionId,
          name: sessionName,
          date: sessionDate,
          time: sessionTime,
          duration,
          qr_code: JSON.stringify(qrData),
          expires_at: expiryTime.toISOString(),
          is_active: true
        })
        .select();
      
      if (error) throw error;
      
      // Reload data
      window.location.reload();
    } catch (error) {
      console.error("Error creating session:", error);
      alert("Error creating session: " + error.message);
    }
  };

  const handleExportAttendance = () => {
    if (!activeSession) {
      alert("No active session to export");
      return;
    }
    
    const attendanceRecords = [];
    // In a real app, you would map the attendance records properly
    exportAttendanceToExcel(attendanceRecords, activeSession.name);
  };

  // Fetch active session and attendance data
  const fetchActiveSession = async () => {
    try {
      // First get the active session
      const { data: sessionData, error: sessionError } = await supabase
        .from('sessions')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
        
      if (sessionError && sessionError.code !== 'PGRST116') {
        console.error('Error fetching active session:', sessionError);
        return;
      }
      
      if (sessionData) {
        console.log('Active session found:', sessionData);
        setActiveSession(sessionData);
        
        // Set QR code data
        if (sessionData.qr_code) {
          try {
            setQrCodeData(sessionData.qr_code);
            setQrCodeUrl(new URL(sessionData.qr_code).href);
          } catch {
            setQrCodeData(sessionData.id);
          }
        } else {
          setQrCodeData(sessionData.id);
        }
        
        // Check if session has expired
        if (isQRCodeExpired(sessionData)) {
          console.log('Session has expired, ending it automatically');
          await endSession(sessionData.id);
        } else {
          // Set up automatic expiration
          setupSessionExpiration(sessionData);
          
          // Start time remaining countdown
          if (expirationIntervalId) {
            clearInterval(expirationIntervalId);
          }
          
          const intervalId = setInterval(() => {
            const remaining = getQRCodeTimeRemaining(sessionData);
            setTimeRemaining(remaining);
            
            if (remaining === "0:00") {
              clearInterval(intervalId);
              endSession(sessionData.id);
            }
          }, 1000);
          
          setExpirationIntervalId(intervalId);
        }
      } else {
        setActiveSession(null);
        setQrCodeData("");
        setQrCodeUrl("");
        
        // Clear any existing interval
        if (expirationIntervalId) {
          clearInterval(expirationIntervalId);
          setExpirationIntervalId(null);
        }
      }
    } catch (error) {
      console.error('Error in fetchActiveSession:', error);
    }
  };

  // Set up automatic session expiration
  const setupSessionExpiration = (session: any) => {
    // Clear any existing timeout
    if (sessionExpirationTimeout.current) {
      clearTimeout(sessionExpirationTimeout.current);
      sessionExpirationTimeout.current = null;
    }
    
    // Set up new timeout
    const timeoutId = setupSessionExpirationHandler(session, () => {
      endSession(session.id);
    });
    
    if (timeoutId) {
      sessionExpirationTimeout.current = timeoutId;
    }
  };

  // End a session
  const endSession = async (sessionId: string) => {
    try {
      // Update the session in the database
      const { data, error } = await supabase
        .from('sessions')
        .update({ is_active: false })
        .eq('id', sessionId);
        
      if (error) {
        console.error('Error ending session:', error);
        toast({
          title: "Error",
          description: "Failed to end session. Please try again.",
          variant: "destructive"
        });
        return;
      }
      
      // Update UI
      setActiveSession(null);
      setQrCodeData("");
      setQrCodeUrl("");
      
      // Clear intervals and timeouts
      if (expirationIntervalId) {
        clearInterval(expirationIntervalId);
        setExpirationIntervalId(null);
      }
      
      if (sessionExpirationTimeout.current) {
        clearTimeout(sessionExpirationTimeout.current);
        sessionExpirationTimeout.current = null;
      }
      
      toast({
        title: "Success",
        description: "Session ended successfully"
      });
      
      // Refresh sessions
      fetchActiveSession();
    } catch (error) {
      console.error('Error in endSession:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred"
      });
    }
  };

  // Fetch data on component mount
  useEffect(() => {
    fetchActiveSession();
    
    // Set up polling for data refresh (every 30 seconds)
    const intervalId = setInterval(fetchActiveSession, 30000);
    
    return () => {
      clearInterval(intervalId);
      
      // Clear any session expiration intervals or timeouts
      if (expirationIntervalId) {
        clearInterval(expirationIntervalId);
      }
      
      if (sessionExpirationTimeout.current) {
        clearTimeout(sessionExpirationTimeout.current);
      }
    };
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold">Attendance Management</h2>
        <div className="flex gap-4">
          <Select value={sessionFilter} onValueChange={setSessionFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Sessions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sessions</SelectItem>
              <SelectItem value="active">Active Only</SelectItem>
              <SelectItem value="inactive">Inactive Only</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleExportAttendance} disabled={!activeSession}>
            <Download className="mr-2 h-4 w-4" /> Export
          </Button>
        </div>
      </div>

      {/* Active Session Section */}
      <Card className="mb-8">
        <CardContent className="p-6">
          {activeSession ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-xl font-bold mb-2">{activeSession.name}</h3>
                <p className="text-muted-foreground mb-4">
                  {activeSession.date} • {activeSession.time} • {activeSession.duration} minutes
                </p>
                <div className="flex items-center space-x-2 mb-4">
                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                    Active Session
                  </Badge>
                  <Badge variant="outline">
                    Expires: {new Date(activeSession.expires_at).toLocaleTimeString()}
                  </Badge>
                </div>
                <div className="space-y-4">
                  <Button className="mr-2">
                    <Download className="mr-2 h-4 w-4" /> Download QR Code
                  </Button>
                  <Button variant="outline" onClick={() => {
                    if (confirm("Are you sure you want to end this session?")) {
                      // First update the UI optimistically
                      setActiveSession(null);
                      
                      // Then update the database
                      supabase
                        .from('sessions')
                        .update({ is_active: false })
                        .eq('id', activeSession.id)
                        .then(({ data, error }) => {
                          if (error) {
                            console.error("Error ending session:", error);
                            toast({
                              title: "Error",
                              description: "Failed to end session. Please try again.",
                              variant: "destructive"
                            });
                            // Revert UI state if there was an error
                            fetchActiveSession();
                          } else {
                            console.log("Session ended successfully:", data);
                            toast({
                              title: "Success",
                              description: "Session ended successfully"
                            });
                            // Use router navigation instead of window.location.reload()
                            setTimeout(() => {
                              window.location.href = window.location.origin + "/admin";
                            }, 1000);
                          }
                        });
                    }
                  }}>
                    End Session
                  </Button>
                </div>
              </div>
              <div className="flex flex-col items-center justify-center">
                {qrCodeUrl && (
                  <div className="border-4 border-primary rounded-lg p-4 bg-white">
                    <QRCodeSVG value={qrCodeData} size={200} />
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center p-10">
              <p className="text-muted-foreground mb-4">No active session. Generate a QR code to start a session.</p>
              <Dialog>
                <DialogTrigger asChild>
                  <Button>
                    <PlusCircle className="mr-2 h-4 w-4" /> Create New Session
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Attendance Session</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="session-name">Session Name</Label>
                      <Input 
                        id="session-name" 
                        value={sessionName} 
                        onChange={(e) => setSessionName(e.target.value)} 
                        placeholder="e.g. Morning Class" 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="session-date">Date</Label>
                      <Input 
                        id="session-date" 
                        type="date" 
                        value={sessionDate} 
                        onChange={(e) => setSessionDate(e.target.value)} 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="session-time">Time</Label>
                      <Input 
                        id="session-time" 
                        type="time" 
                        value={sessionTime} 
                        onChange={(e) => setSessionTime(e.target.value)} 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="session-duration">Duration (minutes)</Label>
                      <Input 
                        id="session-duration" 
                        type="number" 
                        value={sessionDuration} 
                        onChange={(e) => setSessionDuration(e.target.value)} 
                      />
                    </div>
                  </div>
                  <Button onClick={handleCreateSession}>Create Session</Button>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Attendance Summary */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Attendance Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
              <p className="text-sm text-muted-foreground">Total Sessions</p>
              <h3 className="text-2xl font-bold">{sessionStats.length}</h3>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
              <p className="text-sm text-muted-foreground">Average Attendance</p>
              <h3 className="text-2xl font-bold">{overallStats.averageAttendance}</h3>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
              <p className="text-sm text-muted-foreground">Perfect Attendance</p>
              <h3 className="text-2xl font-bold">{overallStats.perfectAttendance}</h3>
            </div>
          </div>

          <div className="mt-8 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead>
                <tr>
                  <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Session</th>
                  <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Date</th>
                  <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Present</th>
                  <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Absent</th>
                  <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Percentage</th>
                  <th scope="col" className="px-4 py-2 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-3 text-sm text-center">Loading sessions...</td>
                  </tr>
                ) : sessionStats.length > 0 ? (
                  sessionStats.map((session) => (
                    <tr key={session.id}>
                      <td className="px-4 py-3 text-sm">{session.name}</td>
                      <td className="px-4 py-3 text-sm">{session.date}</td>
                      <td className="px-4 py-3 text-sm">{session.present}</td>
                      <td className="px-4 py-3 text-sm">{session.absent}</td>
                      <td className="px-4 py-3 text-sm">{session.percentage}</td>
                      <td className="px-4 py-3 text-sm text-right">
                        <Button variant="link" size="sm">Details</Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-3 text-sm text-center text-muted-foreground">
                      No sessions found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}