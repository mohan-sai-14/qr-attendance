import React, { useState, useEffect } from 'react';
import { 
  Users, Clock, Calendar, Download, BarChart, 
  ChevronDown, ChevronUp, Filter, RefreshCw, Plus, Search
} from 'lucide-react';

const QRAttendancePage: React.FC = () => {
  const [activeSession, setActiveSession] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [sessions, setSessions] = useState([]);
  const [attendanceStats, setAttendanceStats] = useState({
    totalStudents: 45,
    present: 32,
    absent: 13,
    attendanceRate: '71%'
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [sortColumn, setSortColumn] = useState('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [showFilters, setShowFilters] = useState(false);

  // Dummy students data
  const studentsData = [
    { id: 1, name: 'John Smith', studentId: 'S1001', status: 'present', checkInTime: '09:15 AM' },
    { id: 2, name: 'Emily Johnson', studentId: 'S1002', status: 'present', checkInTime: '09:05 AM' },
    { id: 3, name: 'Michael Williams', studentId: 'S1003', status: 'absent', checkInTime: '-' },
    { id: 4, name: 'Jessica Brown', studentId: 'S1004', status: 'present', checkInTime: '09:10 AM' },
    { id: 5, name: 'Daniel Jones', studentId: 'S1005', status: 'late', checkInTime: '09:32 AM' },
    { id: 6, name: 'Sarah Miller', studentId: 'S1006', status: 'present', checkInTime: '09:08 AM' },
    { id: 7, name: 'James Davis', studentId: 'S1007', status: 'absent', checkInTime: '-' },
    { id: 8, name: 'Jennifer Garcia', studentId: 'S1008', status: 'present', checkInTime: '09:12 AM' },
  ];

  const fetchActiveSession = async () => {
    try {
      console.log('Admin: Fetching active session...');
      const response = await fetch('http://localhost:3000/api/sessions/active', {
        headers: {
          'Accept': 'application/json'
        }
      });
      
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.error('Admin: Non-JSON response:', contentType);
        setActiveSession(null);
        return;
      }
      
      const data = await response.json();
      console.log('Admin: Active session response:', data);
      
      if (data.success && data.data) {
        console.log('Admin: Active session found:', data.data.id);
        setActiveSession(data.data);
        
        // Generate QR code for the session
        generateQRCode(data.data);
      } else {
        console.log('Admin: No active session:', data.message);
        setActiveSession(null);
      }
    } catch (error) {
      console.error('Admin: Error fetching active session:', error);
      setActiveSession(null);
    } finally {
      setLoading(false);
    }
  };

  // Set up polling for active session
  useEffect(() => {
    // Initial fetch
    fetchActiveSession();
    
    // Set up interval for polling active session
    const intervalId = setInterval(() => {
      fetchActiveSession();
    }, 5000); // Poll every 5 seconds
    
    // Clean up interval on component unmount
    return () => clearInterval(intervalId);
  }, []);

  const generateQRCode = (session: any) => {
    try {
      console.log('Admin: Generating QR code for session:', session.id);
      
      // Create a QR code data object with session information
      const qrData = JSON.stringify({
        sessionId: session.id,
        name: session.name,
        expires_at: session.expires_at
      });
      
      // Get the QR code container element
      const qrContainer = document.getElementById('qr-code-container');
      if (!qrContainer) {
        console.error('Admin: QR code container not found');
        return;
      }
      
      // Clear previous QR code if any
      qrContainer.innerHTML = '';
      
      // Dynamically import the QRCode library to avoid errors
      import('qrcode').then((QRCode) => {
        // Generate the QR code as SVG
        QRCode.toCanvas(qrContainer, qrData, {
          width: 256,
          margin: 1,
          errorCorrectionLevel: 'H'
        }, (error) => {
          if (error) {
            console.error('Admin: Error generating QR code:', error);
          } else {
            console.log('Admin: QR code generated successfully');
          }
        });
      }).catch(error => {
        console.error('Admin: Error loading QRCode library:', error);
      });
    } catch (error) {
      console.error('Admin: Error in generateQRCode:', error);
    }
  };

  const handleCreateSession = async () => {
    try {
      const sessionName = prompt('Enter session name:');
      if (!sessionName) return;

      console.log('Admin: Creating new session:', sessionName);
      
      const response = await fetch('http://localhost:3000/api/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          name: sessionName,
          expires_after: 20 * 60 * 1000 // 20 minutes
        })
      });
      
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.error('Admin: Non-JSON response from session creation:', contentType);
        alert('Error creating session: Server returned invalid response');
        return;
      }
      
      const data = await response.json();
      console.log('Admin: Session creation response:', data);
      
      if (data.success && data.data) {
        console.log('Admin: Session created successfully:', data.data.id);
        // Immediately fetch the active session after creating a new one
        fetchActiveSession();
      } else {
        console.error('Admin: Failed to create session:', data.message);
        alert('Failed to create session: ' + data.message);
      }
    } catch (error) {
      console.error('Admin: Error creating session:', error);
      alert('Failed to create session. Please try again.');
    }
  };

  const handleExportAttendance = () => {
    // Implementation for exporting attendance data
    console.log('Exporting attendance data');
  };

  const handleToggleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const handleToggleFilters = () => {
    setShowFilters(!showFilters);
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleRefresh = () => {
    fetchActiveSession();
  };

  // Filter and sort students based on search term and sort settings
  const filteredStudents = studentsData.filter(
    student => 
      student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.studentId.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a, b) => {
    let comparison = 0;
    if (sortColumn === 'name') {
      comparison = a.name.localeCompare(b.name);
    } else if (sortColumn === 'studentId') {
      comparison = a.studentId.localeCompare(b.studentId);
    } else if (sortColumn === 'status') {
      comparison = a.status.localeCompare(b.status);
    } else if (sortColumn === 'checkInTime') {
      comparison = a.checkInTime.localeCompare(b.checkInTime);
    }
    
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  return (
    <div className="space-y-6 px-4 py-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4 sm:mb-0">Attendance Management</h1>
        <button 
          onClick={handleCreateSession}
          className="btn btn-primary flex items-center justify-center"
        >
          <Plus size={18} className="mr-2" /> Create Session
        </button>
      </div>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="card p-6 flex items-center animate-fade-in">
          <div className="rounded-full bg-primary-100 p-3 mr-4">
            <Users className="h-6 w-6 text-primary-700" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">Total Students</h3>
            <p className="text-2xl font-bold text-gray-800">{attendanceStats.totalStudents}</p>
          </div>
        </div>
        
        <div className="card p-6 flex items-center animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <div className="rounded-full bg-green-100 p-3 mr-4">
            <Clock className="h-6 w-6 text-green-700" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">Present Today</h3>
            <p className="text-2xl font-bold text-gray-800">{attendanceStats.present}</p>
          </div>
        </div>
        
        <div className="card p-6 flex items-center animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <div className="rounded-full bg-blue-100 p-3 mr-4">
            <BarChart className="h-6 w-6 text-blue-700" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">Attendance Rate</h3>
            <p className="text-2xl font-bold text-gray-800">{attendanceStats.attendanceRate}</p>
          </div>
        </div>
      </div>
      
      {/* Session and QR Code Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Session Card */}
        <div className="card overflow-hidden animate-fade-in" style={{ animationDelay: '0.3s' }}>
          <div className="bg-primary-600 px-6 py-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white flex items-center">
                <Calendar className="mr-2 h-5 w-5" />
                Active Session
              </h2>
              <button 
                onClick={handleCreateSession}
                className="bg-white text-primary-700 px-3 py-1 rounded-md text-sm font-medium hover:bg-primary-50 transition-colors flex items-center"
              >
                <Plus size={16} className="mr-1" />
                New Session
              </button>
            </div>
          </div>
          
          <div className="p-6">
            {loading ? (
              <div className="py-8 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary-500 border-t-transparent"></div>
                <p className="mt-2 text-gray-500">Loading session data...</p>
              </div>
            ) : activeSession ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-gray-800">{activeSession.name}</h3>
                    <p className="text-sm text-gray-500">Session ID: {activeSession.id}</p>
                  </div>
                  <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                    Active
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div>
                    <p className="text-sm text-gray-500">Created At</p>
                    <p className="font-medium">{new Date(activeSession.created_at).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Expires At</p>
                    <p className="font-medium">{new Date(activeSession.expires_at).toLocaleString()}</p>
                  </div>
                </div>
                
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-gray-700">Attendance Code</h4>
                    <span className="bg-primary-100 text-primary-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                      {activeSession.code || "ABC123"}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">
                    Share this code with students who are unable to scan the QR code.
                  </p>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center">
                <div className="inline-block rounded-full bg-gray-100 p-3 mb-4">
                  <Calendar className="h-6 w-6 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-800 mb-2">No Active Session</h3>
                <p className="text-gray-500 mb-6">There is no active session. Create a new one to begin.</p>
                <button 
                  onClick={handleCreateSession}
                  className="btn btn-primary"
                >
                  Create New Session
                </button>
              </div>
            )}
          </div>
        </div>
        
        {/* QR Code Card */}
        <div className="card overflow-hidden animate-fade-in" style={{ animationDelay: '0.4s' }}>
          <div className="bg-primary-600 px-6 py-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white flex items-center">
                <BarChart className="mr-2 h-5 w-5" />
                QR Code
              </h2>
              <button 
                onClick={handleRefresh}
                className="bg-white text-primary-700 px-3 py-1 rounded-md text-sm font-medium hover:bg-primary-50 transition-colors flex items-center"
              >
                <RefreshCw size={16} className="mr-1" />
                Refresh
              </button>
            </div>
          </div>
          
          <div className="p-6">
            {loading ? (
              <div className="py-8 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary-500 border-t-transparent"></div>
                <p className="mt-2 text-gray-500">Generating QR code...</p>
              </div>
            ) : activeSession ? (
              <div className="flex flex-col items-center">
                <div className="bg-white p-4 rounded-lg border-2 border-gray-200 shadow-sm mb-4">
                  <canvas 
                    id="qr-code-container" 
                    className="w-48 h-48 md:w-64 md:h-64"
                  ></canvas>
                </div>
                
                <div className="text-center">
                  <p className="text-sm text-gray-500 mb-2">
                    QR code will expire at: <span className="font-medium">{new Date(activeSession.expires_at).toLocaleTimeString()}</span>
                  </p>
                  <button 
                    onClick={() => generateQRCode(activeSession)}
                    className="btn btn-secondary"
                  >
                    Regenerate QR Code
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center">
                <div className="inline-block rounded-full bg-gray-100 p-3 mb-4">
                  <BarChart className="h-6 w-6 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-800 mb-2">No QR Code Available</h3>
                <p className="text-gray-500">Create an active session to generate a QR code.</p>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Attendance Table */}
      <div className="card overflow-hidden animate-fade-in" style={{ animationDelay: '0.5s' }}>
        <div className="bg-primary-600 px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-white flex items-center">
              <Users className="mr-2 h-5 w-5" />
              Student Attendance
            </h2>
            <div className="flex items-center space-x-2">
              <button 
                onClick={handleToggleFilters}
                className="bg-white text-primary-700 px-3 py-1 rounded-md text-sm font-medium hover:bg-primary-50 transition-colors flex items-center"
              >
                <Filter size={16} className="mr-1" />
                Filters
              </button>
              <button 
                onClick={handleExportAttendance}
                className="bg-white text-primary-700 px-3 py-1 rounded-md text-sm font-medium hover:bg-primary-50 transition-colors flex items-center"
              >
                <Download size={16} className="mr-1" />
                Export
              </button>
            </div>
          </div>
        </div>
        
        {/* Filters and Search */}
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <Search className="w-4 h-4 text-gray-400" />
              </div>
              <input
                type="text"
                className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full pl-10 p-2.5"
                placeholder="Search students..."
                value={searchTerm}
                onChange={handleSearch}
              />
            </div>
            
            {showFilters && (
              <div className="flex items-center space-x-4">
                <select className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block p-2.5">
                  <option value="">All Statuses</option>
                  <option value="present">Present</option>
                  <option value="absent">Absent</option>
                  <option value="late">Late</option>
                </select>
                
                <select className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block p-2.5">
                  <option value="today">Today</option>
                  <option value="yesterday">Yesterday</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                </select>
              </div>
            )}
          </div>
        </div>
        
        {/* Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th 
                  onClick={() => handleToggleSort('name')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  <div className="flex items-center space-x-1">
                    <span>Student Name</span>
                    {sortColumn === 'name' && (
                      sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                    )}
                  </div>
                </th>
                <th 
                  onClick={() => handleToggleSort('studentId')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  <div className="flex items-center space-x-1">
                    <span>Student ID</span>
                    {sortColumn === 'studentId' && (
                      sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                    )}
                  </div>
                </th>
                <th 
                  onClick={() => handleToggleSort('status')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  <div className="flex items-center space-x-1">
                    <span>Status</span>
                    {sortColumn === 'status' && (
                      sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                    )}
                  </div>
                </th>
                <th 
                  onClick={() => handleToggleSort('checkInTime')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  <div className="flex items-center space-x-1">
                    <span>Check-in Time</span>
                    {sortColumn === 'checkInTime' && (
                      sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                    )}
                  </div>
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredStudents.length > 0 ? (
                filteredStudents.map((student) => (
                  <tr key={student.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-medium">
                          {student.name.charAt(0)}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{student.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">{student.studentId}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {student.status === 'present' && (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                          Present
                        </span>
                      )}
                      {student.status === 'absent' && (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                          Absent
                        </span>
                      )}
                      {student.status === 'late' && (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                          Late
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {student.checkInTime}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button className="text-primary-600 hover:text-primary-900">Edit</button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                    No students found matching the search criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <div className="flex-1 flex justify-between sm:hidden">
            <button className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
              Previous
            </button>
            <button className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
              Next
            </button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Showing <span className="font-medium">1</span> to <span className="font-medium">8</span> of{' '}
                <span className="font-medium">24</span> results
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                <button className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50">
                  <span className="sr-only">Previous</span>
                  <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                </button>
                <button className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50">
                  1
                </button>
                <button className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-primary-50 text-sm font-medium text-primary-600 hover:bg-primary-100">
                  2
                </button>
                <button className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50">
                  3
                </button>
                <button className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50">
                  <span className="sr-only">Next</span>
                  <ChevronRight className="h-5 w-5" aria-hidden="true" />
                </button>
              </nav>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QRAttendancePage; 