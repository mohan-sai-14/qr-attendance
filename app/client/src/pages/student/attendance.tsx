import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { SimpleLink } from "@/components/ui/simple-link";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarCheck, ArrowLeft } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

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

export default function StudentAttendance() {
  const { user } = useAuth();
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  // Calculate attendance stats
  const calculateStats = () => {
    if (attendanceRecords.length === 0) return { total: 0, present: 0, percentage: 0 };
    
    const present = attendanceRecords.filter(record => record.status === 'present').length;
    const total = attendanceRecords.length;
    const percentage = Math.round((present / total) * 100);
    
    return { total, present, percentage };
  };

  const stats = calculateStats();

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <header className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Attendance History</h1>
            <p className="text-muted-foreground mt-1">
              Complete record of your attendance
            </p>
          </div>
          <SimpleLink to="/student" className="hidden md:block">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </SimpleLink>
        </div>
      </header>

      {/* Attendance Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? <Skeleton className="h-8 w-12" /> : stats.total}
            </div>
          </CardContent>
        </Card>
      
      <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Present</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? <Skeleton className="h-8 w-12" /> : stats.present}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Attendance Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? <Skeleton className="h-8 w-16" /> : `${stats.percentage}%`}
            </div>
          </CardContent>
        </Card>
          </div>
          
      {/* Attendance Records */}
      <Card>
        <CardHeader>
          <CardTitle>Attendance Records</CardTitle>
          <CardDescription>History of your attendance for all sessions</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-6">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : error ? (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : attendanceRecords.length > 0 ? (
          <div className="overflow-x-auto">
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
            </div>
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
    </div>
  );
}
