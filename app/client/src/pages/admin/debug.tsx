import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SimpleLink } from "@/components/ui/simple-link";
import { useAuth } from "@/lib/auth";
import { Loader2 } from "lucide-react";

export default function DebugPage() {
  const { user, isLoading: userLoading } = useAuth();
  const { toast } = useToast();
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [testSession, setTestSession] = useState<any>(null);
  const [checkingSession, setCheckingSession] = useState(false);
  const [activeSession, setActiveSession] = useState<any>(null);
  
  // Create a test session for attendance testing
  const createTestSession = async () => {
    setIsCreatingSession(true);
    
    try {
      const response = await fetch('/api/create-test-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        toast({
          title: "Error",
          description: result.error || result.message || "Failed to create test session",
          variant: "destructive"
        });
        return;
      }
      
      setTestSession(result.session);
      
      toast({
        title: "Success",
        description: result.message || "Test session created successfully"
      });
    } catch (error) {
      console.error("Error creating test session:", error);
      toast({
        title: "Error",
        description: "An error occurred while creating the test session",
        variant: "destructive"
      });
    } finally {
      setIsCreatingSession(false);
    }
  };
  
  // Check for active sessions
  const checkActiveSession = async () => {
    setCheckingSession(true);
    
    try {
      const response = await fetch('/api/sessions/active', {
        method: 'GET',
        credentials: 'include'
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        toast({
          title: "Error",
          description: "Failed to check active sessions",
          variant: "destructive"
        });
        return;
      }
      
      setActiveSession(result);
      
      toast({
        title: "Session Check Complete",
        description: result.is_active 
          ? "Active session found" 
          : "No active session found"
      });
    } catch (error) {
      console.error("Error checking active session:", error);
      toast({
        title: "Error",
        description: "An error occurred while checking for active sessions",
        variant: "destructive"
      });
    } finally {
      setCheckingSession(false);
    }
  };
  
  // Not logged in or not an admin
  if (userLoading) {
    return (
      <div className="container mx-auto p-4 flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }
  
  if (!user || user.role !== 'admin') {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4">This page is only accessible to administrators.</p>
            <SimpleLink to="/">
              <Button>Return to Home</Button>
            </SimpleLink>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto p-4">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Admin Debug Tools</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4">Use these tools to test and troubleshoot the attendance system.</p>
          
          <div className="space-y-6">
            <div className="space-y-2">
              <h3 className="text-lg font-medium">Test Session Management</h3>
              <div className="flex flex-wrap gap-4">
                <Button 
                  onClick={createTestSession} 
                  disabled={isCreatingSession}
                >
                  {isCreatingSession ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...
                    </>
                  ) : (
                    "Create Test Session"
                  )}
                </Button>
                
                <Button 
                  onClick={checkActiveSession}
                  disabled={checkingSession}
                  variant="outline"
                >
                  {checkingSession ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Checking...
                    </>
                  ) : (
                    "Check Active Session"
                  )}
                </Button>
              </div>
            </div>
            
            {testSession && (
              <div className="space-y-2 bg-primary/5 p-4 rounded-md">
                <h3 className="text-lg font-medium">Created Test Session</h3>
                <pre className="text-sm bg-background p-2 rounded overflow-auto">
                  {JSON.stringify(testSession, null, 2)}
                </pre>
                <p className="text-sm">
                  Session ID: <code className="bg-primary/10 px-1 py-0.5 rounded">{testSession.id}</code>
                </p>
                <p className="text-sm mt-2">
                  You can use this session ID to test QR scanning and attendance recording.
                </p>
              </div>
            )}
            
            {activeSession && (
              <div className="space-y-2 bg-primary/5 p-4 rounded-md">
                <h3 className="text-lg font-medium">Current Active Session</h3>
                <pre className="text-sm bg-background p-2 rounded overflow-auto">
                  {JSON.stringify(activeSession, null, 2)}
                </pre>
              </div>
            )}
            
            <div className="space-y-2">
              <h3 className="text-lg font-medium">Quick Links</h3>
              <div className="flex flex-wrap gap-4">
                <SimpleLink to="/student/scanner">
                  <Button variant="outline">Go to QR Scanner</Button>
                </SimpleLink>
                
                <SimpleLink to="/student">
                  <Button variant="outline">Student Dashboard</Button>
                </SimpleLink>
                
                <SimpleLink to="/admin">
                  <Button variant="outline">Admin Dashboard</Button>
                </SimpleLink>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 