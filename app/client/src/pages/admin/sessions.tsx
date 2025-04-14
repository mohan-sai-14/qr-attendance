import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { createClient } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { markAbsentStudents } from '@/lib/attendance';
import QRCode from 'qrcode.react';

const supabaseUrl = 'https://qwavakkbfpdgkvtctogx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF3YXZha2tiZnBkZ2t2dGN0b2d4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI3MTE4MjYsImV4cCI6MjA1ODI4NzgyNn0.Kdwo9ICmcsHPhK_On6G73ccSPkcEqzAg2BtvblhD8co';
const supabase = createClient(supabaseUrl, supabaseKey);

export default function SessionsPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [endingSession, setEndingSession] = useState<string | null>(null);
  const [baseUrl, setBaseUrl] = useState('');

  useEffect(() => {
    // Get the base URL for QR code generation
    setBaseUrl(window.location.origin);
    fetchSessions();
    
    // Subscribe to session changes
    const channel = supabase
      .channel('sessions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, () => {
        fetchSessions();
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, []);

  const fetchSessions = async () => {
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSessions(data || []);
    } catch (error) {
      console.error('Error fetching sessions:', error);
      toast.error('Failed to fetch sessions');
    } finally {
      setLoading(false);
    }
  };

  const createSession = async () => {
    try {
      const { data, error } = await supabase
        .from('sessions')
        .insert([
          {
            is_active: true,
            created_at: new Date().toISOString(),
          },
        ])
        .select();

      if (error) throw error;
      toast.success('New session created successfully');
      fetchSessions();
    } catch (error) {
      console.error('Error creating session:', error);
      toast.error('Failed to create session');
    }
  };

  const endSession = async (sessionId: string) => {
    try {
      setEndingSession(sessionId);
      const result = await markAbsentStudents(sessionId);
      
      if (!result.success) {
        throw new Error('Failed to mark absent students');
      }
      
      toast.success('Session ended and absent students marked');
      fetchSessions();
    } catch (error) {
      console.error('Error ending session:', error);
      toast.error('Failed to end session');
    } finally {
      setEndingSession(null);
    }
  };

  const downloadQR = (sessionId: string) => {
    const canvas = document.getElementById(`qr-${sessionId}`) as HTMLCanvasElement;
    if (canvas) {
      const url = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = url;
      link.download = `session-${sessionId}-qr.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  if (loading) {
    return <div>Loading sessions...</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Sessions</h1>
        <Button onClick={createSession}>Create New Session</Button>
      </div>

      <div className="grid gap-4">
        {sessions.map((session) => (
          <Card key={session.id} className="p-4">
            <div className="flex justify-between items-center">
              <div className="flex-1">
                <p className="font-medium">
                  Session ID: {session.id}
                </p>
                <p className="text-sm text-gray-500">
                  Created: {new Date(session.created_at).toLocaleString()}
                </p>
                {session.ended_at && (
                  <p className="text-sm text-gray-500">
                    Ended: {new Date(session.ended_at).toLocaleString()}
                  </p>
                )}
                <p className={`text-sm ${session.is_active ? 'text-green-500' : 'text-red-500'}`}>
                  Status: {session.is_active ? 'Active' : 'Ended'}
                </p>
              </div>
              
              {session.is_active && (
                <div className="flex flex-col items-center gap-4 ml-4">
                  <div className="bg-white p-2 rounded-lg shadow">
                    <QRCode
                      id={`qr-${session.id}`}
                      value={`${baseUrl}/student/scan?session=${session.id}`}
                      size={128}
                      level="H"
                      includeMargin={true}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => downloadQR(session.id)}
                    >
                      Download QR
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => endSession(session.id)}
                      disabled={endingSession === session.id}
                    >
                      {endingSession === session.id ? 'Ending...' : 'End Session'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
} 