import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileDown, Printer } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function Reports() {
  const [reportType, setReportType] = useState("attendance-summary");
  const [dateRange, setDateRange] = useState("week");
  const [format, setFormat] = useState("xlsx");
  const [sessionSummaries, setSessionSummaries] = useState([]);
  const [studentSummaries, setStudentSummaries] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch reports data
  useEffect(() => {
    const fetchReportsData = async () => {
      try {
        setIsLoading(true);
        
        // Fetch all sessions
        const { data: sessions, error: sessionsError } = await supabase
          .from('sessions')
          .select('*')
          .order('created_at', { ascending: false });
          
        if (sessionsError) throw sessionsError;
        
        // Fetch all students
        const { data: students, error: studentsError } = await supabase
          .from('users')
          .select('*')
          .eq('role', 'student');
          
        if (studentsError) throw studentsError;
        
        // Calculate session summaries
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
              const absentCount = students ? students.length - presentCount : 0;
              const attendanceRate = students && students.length > 0 
                ? Math.round((presentCount / students.length) * 100) 
                : 0;
              
              return {
                ...session,
                present: presentCount,
                absent: absentCount,
                percentage: attendanceRate
              };
            } catch (error) {
              console.error(`Error fetching attendance for session ${session.id}:`, error);
              return {
                ...session,
                present: 0,
                absent: 0,
                percentage: 0
              };
            }
          })
        );
        
        // Calculate student summaries
        const studentsWithStats = await Promise.all(
          (students || []).map(async (student) => {
            try {
              // Get attendance for this student
              const { data: attendance, error: attendanceError } = await supabase
                .from('attendance')
                .select('*')
                .eq('user_id', student.username);
                
              if (attendanceError) throw attendanceError;
              
              const attendedCount = attendance ? attendance.length : 0;
              const totalSessions = sessions ? sessions.length : 0;
              const attendanceRate = totalSessions > 0 
                ? Math.round((attendedCount / totalSessions) * 100) 
                : 0;
              
              return {
                ...student,
                attended: attendedCount,
                missed: totalSessions - attendedCount,
                percentage: attendanceRate
              };
            } catch (error) {
              console.error(`Error fetching attendance for student ${student.id}:`, error);
              return {
                ...student,
                attended: 0,
                missed: 0,
                percentage: 0
              };
            }
          })
        );
        
        setSessionSummaries(sessionsWithStats);
        setStudentSummaries(studentsWithStats);
      } catch (error) {
        console.error("Error fetching reports data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchReportsData();
  }, []);

  const handleGenerateReport = () => {
    // Implement report generation
    alert(`Generating ${reportType} report for the last ${dateRange} in ${format} format`);
  };

  const handleExportAll = () => {
    // Implement export all functionality
    alert("Exporting all reports");
  };

  const handlePrintReport = () => {
    // Implement print functionality
    window.print();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold">Attendance Reports</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportAll}>
            <FileDown className="mr-2 h-4 w-4" />
            Export All
          </Button>
          <Button variant="outline" onClick={handlePrintReport}>
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
        </div>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Generate Report</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="report-type">Report Type</Label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger id="report-type">
                  <SelectValue placeholder="Select Report Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="attendance-summary">Attendance Summary</SelectItem>
                  <SelectItem value="student-performance">Student Performance</SelectItem>
                  <SelectItem value="session-details">Session Details</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="date-range">Date Range</Label>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger id="date-range">
                  <SelectValue placeholder="Select Date Range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Last 24 Hours</SelectItem>
                  <SelectItem value="week">Last 7 Days</SelectItem>
                  <SelectItem value="month">Last 30 Days</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="format">Format</Label>
              <Select value={format} onValueChange={setFormat}>
                <SelectTrigger id="format">
                  <SelectValue placeholder="Select Format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="xlsx">Excel (.xlsx)</SelectItem>
                  <SelectItem value="pdf">PDF Document</SelectItem>
                  <SelectItem value="csv">CSV File</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button className="w-full" onClick={handleGenerateReport}>Generate</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <Tabs defaultValue="sessions">
          <div className="p-4 border-b">
            <TabsList>
              <TabsTrigger value="sessions">Session Attendance Summary</TabsTrigger>
              <TabsTrigger value="students">Student Attendance Summary</TabsTrigger>
            </TabsList>
          </div>
          
          <TabsContent value="sessions" className="p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead>
                  <tr>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Session Name</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Date</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Present</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Absent</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Attendance Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {isLoading ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center">
                        <div className="flex justify-center">
                          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                        </div>
                      </td>
                    </tr>
                  ) : sessionSummaries.length > 0 ? (
                    sessionSummaries.map((session) => (
                      <tr key={session.id}>
                        <td className="px-4 py-3 text-sm">{session.name}</td>
                        <td className="px-4 py-3 text-sm">{session.date}</td>
                        <td className="px-4 py-3 text-sm">{session.present}</td>
                        <td className="px-4 py-3 text-sm">{session.absent}</td>
                        <td className="px-4 py-3 text-sm">{session.percentage}%</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                        No session data available. Create a session and mark attendance first.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>
          
          <TabsContent value="students" className="p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead>
                  <tr>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Student ID</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Name</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Sessions Attended</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Sessions Missed</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Attendance Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {isLoading ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center">
                        <div className="flex justify-center">
                          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                        </div>
                      </td>
                    </tr>
                  ) : studentSummaries.length > 0 ? (
                    studentSummaries.map((student) => (
                      <tr key={student.id || student.username}>
                        <td className="px-4 py-3 text-sm">{student.username}</td>
                        <td className="px-4 py-3 text-sm">{student.name}</td>
                        <td className="px-4 py-3 text-sm">{student.attended}</td>
                        <td className="px-4 py-3 text-sm">{student.missed}</td>
                        <td className="px-4 py-3 text-sm">{student.percentage}%</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                        No student data available. Add students to get started.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}
