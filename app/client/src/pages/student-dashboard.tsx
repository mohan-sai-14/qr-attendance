import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { SimpleLink } from "@/components/ui/simple-link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { ExternalLink, Calendar, Clock, Check, BellRing, CalendarCheck, Home } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// Type for the attendance record
interface AttendanceRecord {
  id: string;
  sessionId: string;
  sessionName: string;
  date: string;
  time: string;
  status: string;
  checkInTime: string;
}

// Type for the active session
interface ActiveSession {
  id: string;
  name: string;
  date: string;
  time: string;
  duration: number;
  status: string;
  attendance: number;
  total: number;
  is_active: boolean;
  expires_at: string;
  checked_in: boolean;
  check_in_time?: string;
}

export default function StudentDashboard() {
  const { user } = useAuth();
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");

  // Fetch active session
  useEffect(() => {
    const fetchActiveSession = async () => {
      try {
        const response = await fetch("/api/sessions/active", {
          credentials: "include",
        });
        
        if (!response.ok) {
          throw new Error(`Error fetching active session: ${response.status}`);
        }
        
        const data = await response.json();
        console.log("Active session data:", data);
        setActiveSession(data);
      } catch (err) {
        console.error("Failed to fetch active session:", err);
        setError("Failed to load active session information");
      }
    };
    
    fetchActiveSession();
  }, []);

  // Fetch attendance records
  useEffect(() => {
    const fetchAttendanceRecords = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/attendance/me", {
          credentials: "include",
        });
        
        if (!response.ok) {
          throw new Error(`Error fetching attendance records: ${response.status}`);
        }
        
        const data = await response.json();
        console.log("Attendance records:", data);
        setAttendanceRecords(data);
      } catch (err) {
        console.error("Failed to fetch attendance records:", err);
        setError("Failed to load attendance history");
      } finally {
        setLoading(false);
      }
    };
    
    fetchAttendanceRecords();
  }, []);

  // Format date
  const formatDate = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  // Format time
  const formatTime = (timeString: string) => {
    // If timeString is already in HH:MM format, convert to 12-hour format
    if (timeString.match(/^\d{1,2}:\d{2}$/)) {
      const [hours, minutes] = timeString.split(':').map(Number);
      const period = hours >= 12 ? 'PM' : 'AM';
      const formattedHours = hours % 12 || 12;
      return `${formattedHours}:${minutes.toString().padStart(2, '0')} ${period}`;
    }
    
    // If it's a full ISO date
    try {
      const date = new Date(timeString);
      return date.toLocaleTimeString(undefined, { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
    } catch (e) {
      return timeString; // Return as is if parsing fails
    }
  };

  // Calculate time remaining for active session
  const getTimeRemaining = (expiresAt: string) => {
    const now = new Date();
    const expiration = new Date(expiresAt);
    const diff = expiration.getTime() - now.getTime();
    
    if (diff <= 0) return "Expired";
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${remainingMinutes}m`;
    }
    return `${minutes}m`;
  };

  // Check if user has already checked in to the active session
  const hasCheckedIn = () => {
    if (!activeSession) return false;
    
    // If the active session already indicates checked_in is true
    if (activeSession.checked_in) return true;
    
    // Also check attendance records manually
    return attendanceRecords.some(record => 
      record.sessionId === activeSession.id
    );
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <header className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Student Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Welcome back, {user?.name || "Student"}
            </p>
          </div>
          <SimpleLink to="/" className="hidden md:block">
            <Button variant="ghost" size="icon">
              <Home className="h-5 w-5" />
            </Button>
          </SimpleLink>
        </div>
      </header>

      <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="history">Attendance History</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-4">
          {/* Active Session Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Active Session</CardTitle>
              <CardDescription>Current ongoing session information</CardDescription>
            </CardHeader>
            <CardContent>
              {activeSession ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">{activeSession.name}</h3>
                    <Badge variant={activeSession.is_active ? "default" : "secondary"}>
                      {activeSession.is_active ? "Active" : "Completed"}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>{formatDate(activeSession.date)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>{formatTime(activeSession.time)} ({activeSession.duration} mins)</span>
                    </div>
                  </div>
                  
                  {activeSession.is_active && (
                    <div className="mt-4 flex items-center justify-between">
                      <div className="text-sm">
                        <span className="font-medium">Time remaining:</span>{" "}
                        <span className="text-muted-foreground">{getTimeRemaining(activeSession.expires_at)}</span>
                      </div>
                      <div className="text-sm">
                        <span className="font-medium">Attendance:</span>{" "}
                        <span className="text-muted-foreground">{activeSession.attendance}/{activeSession.total}</span>
                      </div>
                    </div>
                  )}
                  
                  {hasCheckedIn() ? (
                    <div className="mt-4 rounded-md bg-green-50 dark:bg-green-950 p-3 flex items-center text-green-700 dark:text-green-300">
                      <Check className="h-5 w-5 mr-2" />
                      <div>
                        <p className="font-semibold">Attendance Recorded</p>
                        <p className="text-sm text-green-600 dark:text-green-400">
                          {activeSession.check_in_time ? `Checked in at ${formatTime(activeSession.check_in_time)}` : "Successfully marked as present"}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <SimpleLink to="/student/scan" className="w-full">
                      <Button className="w-full mt-4">
                        Scan QR to Record Attendance
                      </Button>
                    </SimpleLink>
                  )}
                </div>
              ) : error ? (
                <Alert variant="destructive">
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-4">
                  <Skeleton className="h-8 w-3/4" />
                  <div className="grid grid-cols-2 gap-4">
                    <Skeleton className="h-5 w-full" />
                    <Skeleton className="h-5 w-full" />
                  </div>
                  <Skeleton className="h-9 w-full mt-4" />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Attendance */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Recent Attendance</CardTitle>
              <CardDescription>Your latest attendance records</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center justify-between">
                      <Skeleton className="h-5 w-2/3" />
                      <Skeleton className="h-5 w-1/4" />
                    </div>
                  ))}
                </div>
              ) : attendanceRecords.length > 0 ? (
                <div className="space-y-4">
                  {attendanceRecords.slice(0, 3).map((record) => (
                    <div key={record.id} className="flex items-center justify-between border-b border-border pb-3 last:border-0 last:pb-0">
                      <div>
                        <p className="font-medium">{record.sessionName}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(record.date)} at {formatTime(record.checkInTime || record.time)}
                        </p>
                      </div>
                      <Badge variant={record.status === "present" ? "success" : "secondary"}>
                        {record.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">No recent attendance records</p>
              )}
            </CardContent>
            
            {attendanceRecords.length > 3 && (
              <CardFooter className="border-t pt-4 flex justify-center">
                <Button variant="outline" size="sm" onClick={() => setActiveTab("history")}>
                  View All Records
                </Button>
              </CardFooter>
            )}
          </Card>
        </TabsContent>
        
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Attendance History</CardTitle>
              <CardDescription>Complete record of your attendance</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-6">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ) : attendanceRecords.length > 0 ? (
                <Table>
                  <TableCaption>A list of your attendance records</TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Session</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Check-in Time</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendanceRecords.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="font-medium">{record.sessionName}</TableCell>
                        <TableCell>{formatDate(record.date)}</TableCell>
                        <TableCell>{formatTime(record.checkInTime || record.time)}</TableCell>
                        <TableCell>
                          <Badge variant={record.status === "present" ? "success" : "secondary"}>
                            {record.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8">
                  <CalendarCheck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">No attendance records found</h3>
                  <p className="text-muted-foreground mt-1">
                    Your attendance history will appear here once you've checked into sessions.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
