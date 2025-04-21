import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  try {
    const { sessionId, userId } = await request.json();

    if (!sessionId || !userId) {
      return NextResponse.json(
        { error: 'Session ID and User ID are required' },
        { status: 400 }
      );
    }

    // Check if the session exists and is active
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Invalid session' },
        { status: 404 }
      );
    }

    if (!session.is_active) {
      return NextResponse.json(
        { error: 'Session is not active' },
        { status: 400 }
      );
    }

    // Check if attendance record already exists
    const { data: existingRecord, error: checkError } = await supabase
      .from('attendance')
      .select('*')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      return NextResponse.json(
        { error: 'Error checking attendance' },
        { status: 500 }
      );
    }

    if (existingRecord) {
      return NextResponse.json(
        { error: 'Attendance already recorded' },
        { status: 400 }
      );
    }

    // Create attendance record
    const { error: insertError } = await supabase
      .from('attendance')
      .insert([
        {
          session_id: sessionId,
          user_id: userId,
          status: 'present',
          timestamp: new Date().toISOString()
        }
      ]);

    if (insertError) {
      return NextResponse.json(
        { error: 'Error recording attendance' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: 'Attendance recorded successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error processing scan:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 