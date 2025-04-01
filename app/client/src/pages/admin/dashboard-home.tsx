import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookOpen, Users, UserCheck, UserX, Percent } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function DashboardHome() {
  const [timeRange, setTimeRange] = useState("today");
  const [statsData, setStatsData] = useState({
    totalStudents: 0,
    presentStudents: 0,
    absentStudents: 0,
    attendanceRate: 0,
    totalSessions: 0,
    activeSessions: 0
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        
        // Fetch total students
        const { count: totalStudents, error: studentsError } = await supabase
          .from('users')
          .select('*', { count: 'exact', head: true })
          .eq('role', 'student');
          
        if (studentsError) throw studentsError;
        
        // Fetch total sessions
        const { data: sessions, error: sessionsError } = await supabase
          .from('sessions')
          .select('*')
          .order('created_at', { ascending: false });
          
        if (sessionsError) throw sessionsError;
        
        // Fetch active sessions
        const { data: activeSessions, error: activeSessionsError } = await supabase
          .from('sessions')
          .select('*')
          .eq('is_active', true);
          
        if (activeSessionsError) throw activeSessionsError;
        
        // Filter for recent attendance based on time range
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Get attendance records for the most recent session
        let presentStudents = 0;
        let absentStudents = 0;
        let attendanceRate = 0;
        
        if (sessions && sessions.length > 0) {
          // Get the most recent session
          const mostRecentSession = sessions[0];
          
          // Fetch attendance for this session
          const { data: attendance, error: attendanceError } = await supabase
            .from('attendance')
            .select('*')
            .eq('session_id', mostRecentSession.id);
            
          if (attendanceError) throw attendanceError;
          
          // Calculate stats
          presentStudents = attendance ? attendance.length : 0;
          absentStudents = totalStudents ? totalStudents - presentStudents : 0;
          attendanceRate = totalStudents ? Math.round((presentStudents / totalStudents) * 100) : 0;
        }
        
        setStatsData({
          totalStudents: totalStudents || 0,
          totalSessions: sessions ? sessions.length : 0,
          activeSessions: activeSessions ? activeSessions.length : 0,
          presentStudents,
          absentStudents,
          attendanceRate
        });
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
    
    // Set up polling
    const interval = setInterval(fetchData, 15000);
    
    return () => clearInterval(interval);
  }, [timeRange]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Dashboard</h2>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Time Range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="week">This Week</SelectItem>
            <SelectItem value="month">This Month</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between p-4">
            <div className="flex flex-col">
              <CardTitle className="text-lg">Total Students</CardTitle>
              <CardDescription>Registered in system</CardDescription>
            </div>
            <Users className="h-8 w-8 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {isLoading ? (
              <div className="w-16 h-6 bg-gray-200 animate-pulse rounded"></div>
            ) : (
              <div className="text-3xl font-bold">{statsData.totalStudents}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between p-4">
            <div className="flex flex-col">
              <CardTitle className="text-lg">Today's Attendance</CardTitle>
              <CardDescription>Students present</CardDescription>
            </div>
            <UserCheck className="h-8 w-8 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {isLoading ? (
              <div className="w-16 h-6 bg-gray-200 animate-pulse rounded"></div>
            ) : (
              <div className="text-3xl font-bold">{statsData.presentStudents}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between p-4">
            <div className="flex flex-col">
              <CardTitle className="text-lg">Absent Students</CardTitle>
              <CardDescription>Not in attendance</CardDescription>
            </div>
            <UserX className="h-8 w-8 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {isLoading ? (
              <div className="w-16 h-6 bg-gray-200 animate-pulse rounded"></div>
            ) : (
              <div className="text-3xl font-bold">{statsData.absentStudents}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between p-4">
            <div className="flex flex-col">
              <CardTitle className="text-lg">Attendance Rate</CardTitle>
              <CardDescription>Overall performance</CardDescription>
            </div>
            <Percent className="h-8 w-8 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {isLoading ? (
              <div className="w-16 h-6 bg-gray-200 animate-pulse rounded"></div>
            ) : (
              <div className="text-3xl font-bold">{statsData.attendanceRate}%</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Sessions Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                <p className="text-sm text-muted-foreground">Total Sessions</p>
                <h3 className="text-2xl font-bold">{statsData.totalSessions}</h3>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                <p className="text-sm text-muted-foreground">Active Sessions</p>
                <h3 className="text-2xl font-bold">{statsData.activeSessions}</h3>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {isLoading ? (
                <>
                  <div className="h-10 bg-gray-200 animate-pulse rounded"></div>
                  <div className="h-10 bg-gray-200 animate-pulse rounded"></div>
                  <div className="h-10 bg-gray-200 animate-pulse rounded"></div>
                </>
              ) : statsData.totalSessions === 0 ? (
                <p className="text-muted-foreground text-center py-8">No sessions recorded yet.</p>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  {statsData.presentStudents} students attended the most recent session.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
