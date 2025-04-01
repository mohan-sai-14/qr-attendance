import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { History, Download } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = 'https://qwavakkbfpdgkvtctogx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF3YXZha2tiZnBkZ2t2dGN0b2d4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI3MTE4MjYsImV4cCI6MjA1ODI4NzgyNn0.Kdwo9ICmcsHPhK_On6G73ccSPkcEqzAg2BtvblhD8co';
const supabase = createClient(supabaseUrl, supabaseKey);

export default function StudentAttendance() {
  const { user, isOfflineMode } = useAuth();
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("30days");
  const [attendanceData, setAttendanceData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch student's attendance records with session info
  useEffect(() => {
    const fetchAttendanceWithSessionNames = async () => {
      if (!user) return;
      
      try {
        setIsLoading(true);
        
        // Fetch attendance records for the current user
        const { data: attendanceRecords, error } = await supabase
          .from('attendance')
          .select(`
            id,
            user_id,
            session_id,
            check_in_time,
            date,
            status,
            name,
            session_name
          `)
          .eq('user_id', user.username)
          .order('check_in_time', { ascending: false });
          
        if (error) {
          console.error('Error fetching attendance records:', error);
          return;
        }
        
        // Get unique session IDs to fetch session details
        const sessionIds = [...new Set(attendanceRecords.map(record => record.session_id))];
        
        // Fetch session details for all session IDs
        const { data: sessions, error: sessionsError } = await supabase
          .from('sessions')
          .select('id, name, date, time')
          .in('id', sessionIds);
          
        if (sessionsError) {
          console.error('Error fetching session details:', sessionsError);
          return;
        }
        
        // Create a session lookup map
        const sessionMap = {};
        sessions.forEach(session => {
          sessionMap[session.id] = session;
        });
        
        // Join attendance records with session details
        const enrichedAttendance = attendanceRecords.map(record => ({
          ...record,
          session: sessionMap[record.session_id] || { name: "Unknown Session" }
        }));
        
        setAttendanceData(enrichedAttendance);
      } catch (err) {
        console.error('Error processing attendance data:', err);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchAttendanceWithSessionNames();
  }, [user]);

  const handleDownloadReport = () => {
    alert("This would download an attendance report Excel file in a real application.");
  };

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {isOfflineMode && (
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Offline Mode:</strong>
          <span className="block sm:inline"> Limited functionality available. Some data may not be current.</span>
        </div>
      )}
      
      <Card>
        <CardContent className="pt-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <History className="mr-2 h-5 w-5 text-primary" />
            Attendance History
          </h3>
          
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 space-y-2 md:space-y-0">
            <div className="flex items-center space-x-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="All Sessions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sessions</SelectItem>
                  <SelectItem value="present">Present Only</SelectItem>
                  <SelectItem value="absent">Absent Only</SelectItem>
                </SelectContent>
              </Select>
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Last 30 days" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30days">Last 30 days</SelectItem>
                  <SelectItem value="3months">Last 3 months</SelectItem>
                  <SelectItem value="all">All time</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={handleDownloadReport} className="flex items-center">
              <Download className="h-4 w-4 mr-1" /> Download Report
            </Button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Session</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Date</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Check-in</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-3 text-sm text-center">Loading attendance data...</td>
                  </tr>
                ) : attendanceData.length > 0 ? (
                  attendanceData.map((record: any) => (
                    <tr key={record.id} className="border-b border-border">
                      <td className="px-4 py-3 text-sm">
                        {record.session?.name || record.session_name || "Unknown Session"}
                      </td>
                      <td className="px-4 py-3 text-sm">{record.date || new Date(record.check_in_time || Date.now()).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-sm">
                        {record.status === "present" ? (
                          <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                            Present
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                            Absent
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {record.check_in_time ? new Date(record.check_in_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '-'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-4 py-3 text-sm text-center text-muted-foreground">
                      No attendance records found.
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
