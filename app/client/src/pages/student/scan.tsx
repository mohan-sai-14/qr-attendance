import { useEffect, useState } from 'react';
import { QrReader } from 'react-qr-reader';
import { useRouter } from 'next/router';
import { useAuth } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const supabaseUrl = 'https://qwavakkbfpdgkvtctogx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF3YXZha2tiZnBkZ2t2dGN0b2d4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI3MTE4MjYsImV4cCI6MjA1ODI4NzgyNn0.Kdwo9ICmcsHPhK_On6G73ccSPkcEqzAg2BtvblhD8co';
const supabase = createClient(supabaseUrl, supabaseKey);

export default function ScanPage() {
  const [isScanning, setIsScanning] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const router = useRouter();
  const { user } = useAuth();
  const { session: sessionId } = router.query;

  useEffect(() => {
    // If session ID is provided in URL, process it immediately
    if (sessionId && typeof sessionId === 'string') {
      processAttendance(sessionId);
    }
  }, [sessionId]);

  const processAttendance = async (scannedSessionId: string) => {
    try {
      setIsProcessing(true);

      if (!user) {
        throw new Error('You must be logged in to record attendance');
      }

      // Validate the session exists and is active
      const { data: session, error: sessionError } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', scannedSessionId)
        .eq('is_active', true)
        .single();

      if (sessionError || !session) {
        throw new Error('Invalid or inactive session');
      }

      // Check if attendance already recorded
      const { data: existingAttendance, error: attendanceError } = await supabase
        .from('attendance')
        .select('*')
        .eq('session_id', scannedSessionId)
        .eq('user_id', user.id)
        .single();

      if (existingAttendance) {
        toast({
          title: 'Already Recorded',
          description: 'Your attendance for this session has already been recorded.',
        });
        router.push('/student');
        return;
      }

      // Record attendance
      const now = new Date();
      const { error: insertError } = await supabase
        .from('attendance')
        .insert([
          {
            session_id: scannedSessionId,
            user_id: user.id,
            username: user.username,
            name: user.name,
            check_in_time: now.toISOString(),
            date: now.toISOString().split('T')[0],
            status: 'present',
          },
        ]);

      if (insertError) {
        throw insertError;
      }

      toast({
        title: 'Success',
        description: 'Attendance recorded successfully!',
      });

      // Redirect to dashboard
      router.push('/student');
    } catch (error: any) {
      console.error('Error recording attendance:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to record attendance',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleScan = (result: any) => {
    if (result?.text) {
      try {
        const url = new URL(result.text);
        const scannedSessionId = url.searchParams.get('session');
        if (scannedSessionId) {
          setIsScanning(false);
          processAttendance(scannedSessionId);
        }
      } catch (error) {
        console.error('Invalid QR code:', error);
      }
    }
  };

  const handleError = (error: any) => {
    console.error('QR Scanner error:', error);
    toast({
      variant: 'destructive',
      title: 'Scanner Error',
      description: 'Failed to access camera. Please check permissions.',
    });
  };

  return (
    <div className="container mx-auto p-4">
      <Card className="max-w-md mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">Scan Attendance QR Code</h1>
        
        {!isScanning && !isProcessing && (
          <Button 
            onClick={() => setIsScanning(true)}
            className="w-full mb-4"
          >
            Start Scanning
          </Button>
        )}

        {isScanning && (
          <div className="relative aspect-square w-full max-w-sm mx-auto mb-4">
            <QrReader
              constraints={{ facingMode: 'environment' }}
              onResult={handleScan}
              onError={handleError}
              className="w-full h-full"
            />
            <Button
              variant="outline"
              onClick={() => setIsScanning(false)}
              className="absolute top-2 right-2"
            >
              Cancel
            </Button>
          </div>
        )}

        {isProcessing && (
          <div className="text-center">
            <p>Processing attendance...</p>
          </div>
        )}
      </Card>
    </div>
  );
} 