import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = 'https://qwavakkbfpdgkvtctogx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF3YXZha2tiZnBkZ2t2dGN0b2d4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI3MTE4MjYsImV4cCI6MjA1ODI4NzgyNn0.Kdwo9ICmcsHPhK_On6G73ccSPkcEqzAg2BtvblhD8co';
const supabase = createClient(supabaseUrl, supabaseKey);

export async function markAbsentStudents(sessionId: string) {
  try {
    // Get all students
    const { data: students, error: studentsError } = await supabase
      .from('users')
      .select('id, username, name')
      .eq('role', 'student');
    
    if (studentsError) throw studentsError;
    
    // Get students who attended
    const { data: attendees, error: attendeesError } = await supabase
      .from('attendance')
      .select('user_id')
      .eq('session_id', sessionId);
    
    if (attendeesError) throw attendeesError;
    
    // Create a set of attended student IDs for quick lookup
    const attendedIds = new Set(attendees?.map(a => a.user_id) || []);
    
    // Find students who didn't attend
    const absentStudents = students?.filter(student => !attendedIds.has(student.id)) || [];
    
    if (absentStudents.length > 0) {
      // Get current date
      const now = new Date();
      
      // Create attendance records for absent students
      const absentRecords = absentStudents.map(student => ({
        session_id: sessionId,
        user_id: student.id,
        username: student.username,
        name: student.name,
        check_in_time: now.toISOString(),
        date: now.toISOString().split('T')[0],
        status: 'absent'
      }));
      
      // Insert absent records
      const { error: insertError } = await supabase
        .from('attendance')
        .insert(absentRecords);
      
      if (insertError) throw insertError;
    }
    
    // Update session status
    const { error: updateError } = await supabase
      .from('sessions')
      .update({ is_active: false, ended_at: new Date().toISOString() })
      .eq('id', sessionId);
    
    if (updateError) throw updateError;
    
    return { success: true };
  } catch (error) {
    console.error('Error marking absent students:', error);
    return { success: false, error };
  }
}

export async function getAttendanceStats(userId: string) {
  try {
    // Get total sessions
    const { data: sessions, error: sessionsError } = await supabase
      .from('sessions')
      .select('id');
    
    if (sessionsError) throw sessionsError;
    
    // Get user's attendance records
    const { data: attendance, error: attendanceError } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', userId);
    
    if (attendanceError) throw attendanceError;
    
    const totalSessions = sessions?.length || 0;
    const attendedSessions = attendance?.filter(a => a.status === 'present').length || 0;
    const attendanceRate = totalSessions > 0 ? (attendedSessions / totalSessions) * 100 : 0;
    
    return {
      totalSessions,
      attendedSessions,
      attendanceRate: Math.round(attendanceRate),
      success: true
    };
  } catch (error) {
    console.error('Error getting attendance stats:', error);
    return {
      totalSessions: 0,
      attendedSessions: 0,
      attendanceRate: 0,
      success: false,
      error
    };
  }
} 