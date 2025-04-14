import { NextRequest, NextResponse } from 'next/server';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export const runtime = 'edge';

// Handle POST request for scanning QR code
export async function POST(req: NextRequest) {
  try {
    // Create supabase client
    const supabase = createClientComponentClient();
    
    // Get current user session
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'You must be logged in to record attendance' },
        { status: 401 }
      );
    }
    
    // Get user from database
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', session.user.id)
      .single();
      
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'User profile not found' },
        { status: 401 }
      );
    }
    
    // Parse request body
    const data = await req.json();
    const { sessionId, timestamp } = data;
    
    // Validate request
    if (!sessionId) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Session ID is required' },
        { status: 400 }
      );
    }
    
    // Check if the session exists and is active
    const { data: sessionData, error: sessionError } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .maybeSingle();
    
    if (sessionError) {
      console.error('Error checking session:', sessionError);
      return NextResponse.json(
        { error: 'Database Error', message: 'Failed to check session status' },
        { status: 500 }
      );
    }
    
    if (!sessionData) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Session not found' },
        { status: 404 }
      );
    }
    
    if (sessionData.status !== 'active') {
      return NextResponse.json(
        { 
          error: 'Invalid Session', 
          message: 'This session is not active. Attendance can only be marked for active sessions.' 
        },
        { status: 400 }
      );
    }
    
    // Check if attendance already exists for this user and session
    const { data: existingAttendance, error: checkError } = await supabase
      .from('attendance')
      .select('*')
      .eq('session_id', sessionId)
      .eq('user_id', user.id)
      .maybeSingle();
    
    if (checkError) {
      console.error('Error checking existing attendance:', checkError);
      return NextResponse.json(
        { error: 'Database Error', message: 'Failed to check existing attendance' },
        { status: 500 }
      );
    }
    
    let result;
    
    // If attendance already exists, update it
    if (existingAttendance) {
      const { data, error } = await supabase
        .from('attendance')
        .update({
          timestamp: timestamp || new Date().toISOString(),
          status: 'present'
        })
        .eq('id', existingAttendance.id)
        .select()
        .single();
        
      if (error) {
        console.error('Error updating attendance:', error);
        return NextResponse.json(
          { error: 'Database Error', message: 'Failed to update attendance' },
          { status: 500 }
        );
      }
      
      result = data;
    } else {
      // Create new attendance record
      const { data, error } = await supabase
        .from('attendance')
        .insert({
          session_id: sessionId,
          user_id: user.id,
          timestamp: timestamp || new Date().toISOString(),
          status: 'present'
        })
        .select()
        .single();
        
      if (error) {
        console.error('Error creating attendance:', error);
        return NextResponse.json(
          { error: 'Database Error', message: 'Failed to create attendance record' },
          { status: 500 }
        );
      }
      
      result = data;
    }
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error processing scan:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
} 