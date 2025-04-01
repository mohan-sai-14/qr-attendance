import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, Upload, Search, Edit, Trash, Download, MoreHorizontal } from "lucide-react";
import AddStudentModal from "@/components/admin/add-student-modal";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { exportStudentsToExcel, importStudentsFromExcel } from "@/lib/excel";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";

export default function Students() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [studentFilter, setStudentFilter] = useState("all");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [students, setStudents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newStudent, setNewStudent] = useState({
    name: "",
    email: "",
    username: "",
    password: "",
    role: "student"
  });

  // Fetch students data
  useEffect(() => {
    const fetchStudents = async () => {
      try {
        setIsLoading(true);
        
        // Fetch all students
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('role', 'student')
          .order('name', { ascending: true });
          
        if (error) throw error;
        
        // For each student, get their attendance data
        const studentsWithAttendance = await Promise.all(
          (data || []).map(async (student) => {
            try {
              // Get attendance records for this student
              const { data: attendance, error: attendanceError } = await supabase
                .from('attendance')
                .select('*')
                .eq('user_id', student.username);
                
              if (attendanceError) throw attendanceError;
              
              // Get all sessions count
              const { data: sessions, error: sessionsError } = await supabase
                .from('sessions')
                .select('*', { count: 'exact' });
                
              if (sessionsError) throw sessionsError;
              
              // Calculate attendance rate
              const totalSessions = sessions ? sessions.length : 0;
              const attendanceCount = attendance ? attendance.length : 0;
              const attendanceRate = totalSessions > 0 
                ? Math.round((attendanceCount / totalSessions) * 100) 
                : 0;
              
              return {
                ...student,
                attendanceRate: attendanceRate,
                status: getStudentStatus(attendanceRate)
              };
            } catch (error) {
              console.error(`Error fetching attendance for student ${student.id}:`, error);
              return {
                ...student,
                attendanceRate: 0,
                status: 'inactive'
              };
            }
          })
        );
        
        setStudents(studentsWithAttendance);
      } catch (error) {
        console.error("Error fetching students:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchStudents();
    
    // Set up polling
    const interval = setInterval(fetchStudents, 30000);
    
    return () => clearInterval(interval);
  }, []);

  // Get status based on attendance rate
  const getStudentStatus = (rate) => {
    if (rate >= 90) return 'active';
    if (rate >= 75) return 'good';
    if (rate >= 50) return 'warning';
    return 'inactive';
  };

  // Filter students based on search query and filter
  const filteredStudents = students.filter(student => {
    const matchesSearch = 
      student.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.email?.toLowerCase().includes(searchQuery.toLowerCase());
      
    if (studentFilter === 'all') return matchesSearch;
    return matchesSearch && student.status === studentFilter;
  });

  // Handle creating a new student
  const handleCreateStudent = async () => {
    try {
      // Basic validation
      if (!newStudent.name || !newStudent.email || !newStudent.username || !newStudent.password) {
        alert("Please fill in all required fields");
        return;
      }
      
      // Create user in authentication system
      const { data, error } = await supabase.auth.signUp({
        email: newStudent.email,
        password: newStudent.password,
        options: {
          data: {
            name: newStudent.name,
            username: newStudent.username,
            role: 'student'
          }
        }
      });
      
      if (error) throw error;
      
      // Insert user into users table
      const { data: userData, error: userError } = await supabase
        .from('users')
        .insert({
          name: newStudent.name,
          email: newStudent.email,
          username: newStudent.username,
          role: 'student'
        })
        .select();
        
      if (userError) throw userError;
      
      // Reset form and refresh student list
      setNewStudent({
        name: "",
        email: "",
        username: "",
        password: "",
        role: "student"
      });
      
      // Add the new student to the list with default values
      setStudents(prev => [...prev, {
        ...userData[0],
        attendanceRate: 0,
        status: 'inactive'
      }]);
      
      alert("Student created successfully!");
    } catch (error) {
      console.error("Error creating student:", error);
      alert(`Error creating student: ${error.message}`);
    }
  };

  // Handle import students
  const handleImportStudents = () => {
    alert("Import functionality would be implemented here");
  };

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      return apiRequest("DELETE", `/api/users/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users/students'] });
      toast({
        title: "Student Deleted",
        description: "The student has been removed successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to delete student",
        description: error.message || "An error occurred",
      });
    },
  });

  const handleDeleteStudent = (id: number) => {
    if (window.confirm("Are you sure you want to delete this student?")) {
      deleteUserMutation.mutate(id);
    }
  };

  const handleExportStudents = () => {
    if (!students) return;
    exportStudentsToExcel(students);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Student Management</h2>
        <div className="flex space-x-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="h-4 w-4 mr-1" />
                Add Student
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Student</DialogTitle>
                <DialogDescription>
                  Enter the student's information below.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={newStudent.name}
                    onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
                    placeholder="John Doe"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newStudent.email}
                    onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })}
                    placeholder="student@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="username">Student ID</Label>
                  <Input
                    id="username"
                    value={newStudent.username}
                    onChange={(e) => setNewStudent({ ...newStudent, username: e.target.value })}
                    placeholder="S12345"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={newStudent.password}
                    onChange={(e) => setNewStudent({ ...newStudent, password: e.target.value })}
                    placeholder="•••••••••"
                  />
                </div>
              </div>
              <DialogFooter className="mt-4">
                <Button type="submit" onClick={handleCreateStudent}>
                  Create Student
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <div className="relative">
            <input
              type="file"
              id="import-file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleImportStudents}
            />
            <Button variant="outline" onClick={() => document.getElementById("import-file")?.click()} className="flex items-center">
              <Upload className="h-4 w-4 mr-1" /> Import
            </Button>
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex justify-between items-center mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search students..."
                className="pl-10 w-64"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Select value={studentFilter} onValueChange={setStudentFilter}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="All Students" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Students</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="good">Good Standing</SelectItem>
                  <SelectItem value="warning">At Risk</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={handleExportStudents}>
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Student ID</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Name</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Email</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Attendance Rate</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-3 text-sm text-center">Loading students...</td>
                  </tr>
                ) : filteredStudents && filteredStudents.length > 0 ? (
                  filteredStudents.map((student: any) => (
                    <tr key={student.id} className="border-b border-border">
                      <td className="px-4 py-3 text-sm">{student.username}</td>
                      <td className="px-4 py-3 text-sm">{student.name}</td>
                      <td className="px-4 py-3 text-sm">{student.email}</td>
                      <td className="px-4 py-3 text-sm">{student.attendanceRate}%</td>
                      <td className="px-4 py-3 text-sm">
                        {student.status === "active" && (
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Active</Badge>
                        )}
                        {student.status === "good" && (
                          <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">Good Standing</Badge>
                        )}
                        {student.status === "warning" && (
                          <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">At Risk</Badge>
                        )}
                        {student.status === "inactive" && (
                          <Badge variant="outline" className="text-gray-500">Inactive</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        <Button variant="ghost" size="sm" className="text-primary hover:text-primary mr-2">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-red-500 hover:text-red-700"
                          onClick={() => handleDeleteStudent(student.id)}
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-3 text-sm text-center text-muted-foreground">
                      No students found. Add a student to get started.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {filteredStudents && filteredStudents.length > 0 && (
            <div className="flex justify-between items-center mt-4">
              <div className="text-sm text-muted-foreground">
                Showing <span className="font-medium">1-{Math.min(filteredStudents.length, 10)}</span> of <span className="font-medium">{filteredStudents.length}</span> students
              </div>
              <div className="flex space-x-1">
                <Button variant="outline" size="sm" disabled>
                  Previous
                </Button>
                <Button variant="outline" size="sm" className="bg-primary-50 dark:bg-primary-900 text-primary-700 dark:text-primary-100 border-primary-200 dark:border-primary-800">
                  1
                </Button>
                <Button variant="outline" size="sm" disabled={filteredStudents.length <= 10}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Student Modal */}
      <AddStudentModal open={showAddModal} onClose={() => setShowAddModal(false)} />
    </div>
  );
}
