import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Menu, Home, BarChart, Users, Clock, Calendar, LogOut, 
  CheckCircle, Settings, ChevronRight, ChevronLeft, Bell
} from 'lucide-react';

interface DashboardLayoutProps {
  children: React.ReactNode;
  title?: string;
  role?: 'admin' | 'student';
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ 
  children, 
  title = 'Dashboard',
  role = 'admin' 
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [notifications, setNotifications] = useState([
    { id: 1, text: 'New session started', read: false },
    { id: 2, text: '5 students marked present', read: false }
  ]);
  const [showNotifications, setShowNotifications] = useState(false);

  const adminNavItems = [
    { name: 'Dashboard', icon: <Home size={20} />, path: '/admin' },
    { name: 'Attendance', icon: <CheckCircle size={20} />, path: '/admin/attendance' },
    { name: 'QR Generator', icon: <BarChart size={20} />, path: '/admin/qr-generator' },
    { name: 'Sessions', icon: <Calendar size={20} />, path: '/admin/sessions' },
    { name: 'Students', icon: <Users size={20} />, path: '/admin/students' },
    { name: 'Settings', icon: <Settings size={20} />, path: '/admin/settings' },
  ];

  const studentNavItems = [
    { name: 'Dashboard', icon: <Home size={20} />, path: '/student' },
    { name: 'Scan QR', icon: <BarChart size={20} />, path: '/student/scanner' },
    { name: 'My Attendance', icon: <Clock size={20} />, path: '/student/attendance' },
    { name: 'Settings', icon: <Settings size={20} />, path: '/student/settings' },
  ];

  const navItems = role === 'admin' ? adminNavItems : studentNavItems;
  
  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
  
  const markAllAsRead = () => {
    setNotifications(notifications.map(n => ({ ...n, read: true })));
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside 
        className={`fixed inset-y-0 left-0 z-10 flex flex-col bg-gradient-to-b from-primary-700 to-primary-900 text-white transition-all transform shadow-lg 
        ${sidebarOpen ? 'w-64' : 'w-20'}`}
      >
        {/* Sidebar Header */}
        <div className="flex items-center justify-between p-4 border-b border-primary-600">
          <div className="flex items-center space-x-2">
            <div className="flex items-center justify-center bg-white text-primary-700 h-8 w-8 rounded-md">
              <CheckCircle size={20} />
            </div>
            {sidebarOpen && (
              <span className="text-lg font-bold tracking-wider">AttendSync</span>
            )}
          </div>
          <button 
            onClick={toggleSidebar} 
            className="p-1 rounded-full hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-white"
          >
            {sidebarOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
          </button>
        </div>
        
        {/* Sidebar Menu */}
        <nav className="flex-1 pt-6 px-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <Link
              key={item.name}
              to={item.path}
              className="flex items-center px-3 py-3 text-sm font-medium rounded-md transition-all hover:bg-primary-600 group"
            >
              <div className="flex items-center justify-center mr-3">
                {item.icon}
              </div>
              {sidebarOpen && (
                <span className="truncate">{item.name}</span>
              )}
            </Link>
          ))}
        </nav>
        
        {/* Sidebar Footer */}
        <div className="p-4 border-t border-primary-600">
          <Link
            to="/logout"
            className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-primary-600 transition-all"
          >
            <LogOut size={20} className="mr-2" />
            {sidebarOpen && <span>Logout</span>}
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <div className={`flex-1 overflow-auto transition-all ${sidebarOpen ? 'ml-64' : 'ml-20'}`}>
        {/* Top Navigation */}
        <header className="sticky top-0 z-10 bg-white h-16 flex items-center justify-between px-6 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-800">{title}</h1>
          
          <div className="flex items-center space-x-4">
            {/* Notifications */}
            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 rounded-full hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 relative"
              >
                <Bell size={20} />
                {notifications.some(n => !n.read) && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                )}
              </button>
              
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-md shadow-lg py-1 z-20 border border-gray-100 animate-fade-in">
                  <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
                    <h3 className="text-sm font-medium">Notifications</h3>
                    <button 
                      onClick={markAllAsRead}
                      className="text-xs text-primary-600 hover:text-primary-800"
                    >
                      Mark all as read
                    </button>
                  </div>
                  {notifications.length ? (
                    <div className="max-h-72 overflow-y-auto">
                      {notifications.map(notification => (
                        <div 
                          key={notification.id} 
                          className={`px-4 py-2 hover:bg-gray-50 ${!notification.read ? 'bg-blue-50' : ''}`}
                        >
                          <p className="text-sm text-gray-700">{notification.text}</p>
                          <p className="text-xs text-gray-500 mt-1">Just now</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="px-4 py-6 text-center text-gray-500">
                      <p className="text-sm">No notifications</p>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* User Menu */}
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-semibold">
                {role === 'admin' ? 'A' : 'S'}
              </div>
              {role === 'admin' ? (
                <span className="font-medium text-gray-800">Admin User</span>
              ) : (
                <span className="font-medium text-gray-800">John Smith</span>
              )}
            </div>
          </div>
        </header>
        
        {/* Page Content */}
        <main className="p-6 animate-fade-in">
          <div className="animate-slide-up">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout; 