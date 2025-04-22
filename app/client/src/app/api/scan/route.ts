import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'edge';

// Handle POST request for scanning QR code
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { qrCode } = await request.json();

    if (!qrCode) {
      return NextResponse.json(
        { error: 'QR code is required' },
        { status: 400 }
      );
    }

    // Verify the QR code and mark attendance
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('*')
      .eq('qr_code', qrCode)
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Invalid QR code' },
        { status: 400 }
      );
    }

    if (session.status !== 'active') {
      return NextResponse.json(
        { error: 'Session is not active' },
        { status: 400 }
      );
    }

    // Get user from session
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if attendance already exists
    const { data: existingAttendance, error: checkError } = await supabase
      .from('attendance')
      .select('*')
      .eq('session_id', session.id)
      .eq('student_id', user.id)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      return NextResponse.json(
        { error: 'Error checking attendance' },
        { status: 500 }
      );
    }

    if (existingAttendance) {
      return NextResponse.json(
        { error: 'Attendance already marked' },
        { status: 400 }
      );
    }

    // Create attendance record
    const { error: insertError } = await supabase
      .from('attendance')
      .insert({
        session_id: session.id,
        student_id: user.id,
        status: 'present',
        timestamp: new Date().toISOString()
      });

    if (insertError) {
      return NextResponse.json(
        { error: 'Error marking attendance' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: 'Attendance marked successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in scan route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 