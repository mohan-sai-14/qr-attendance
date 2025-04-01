import { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { v4 as uuidv4 } from "uuid"; // Import UUID generator
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Download, QrCode as QrCodeIcon, Check, Loader2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useToast } from "@/hooks/use-toast";
import QRCode from "qrcode";
import { supabase, queryClient } from "@/lib/supabase"; // Import Supabase client and queryClient
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns"; // Add this import for date formatting

const formSchema = z.object({
  name: z.string().min(1, "Session name is required"),
  date: z.string().min(1, "Date is required"),
  time: z.string().min(1, "Time is required"),
  duration: z.coerce.number().min(1, "Duration must be at least 1 minute"),
});

type FormValues = z.infer<typeof formSchema>;

export default function QRGenerator() {
  const [qrValue, setQrValue] = useState<string>("");
  const [qrUrl, setQrUrl] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sessionSaved, setSessionSaved] = useState(false);
  const { toast } = useToast();
  const qrRef = useRef<HTMLDivElement>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [expiryTime, setExpiryTime] = useState<Date | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  // Query to refresh sessions list
  const { refetch: refetchSessions } = useQuery({
    queryKey: ['sessions'],
    queryFn: async () => {
      const { data } = await supabase.from('sessions').select('*');
      return data || [];
    },
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      date: "",
      time: "",
      duration: 60,
    },
  });

  // Clear error message when form is changed
  useEffect(() => {
    const subscription = form.watch(() => {
      if (errorMessage) {
        setErrorMessage(null);
      }
    });
    return () => subscription.unsubscribe();
  }, [form, errorMessage]);

  // Set up countdown timer
  useEffect(() => {
    if (!expiryTime) return;
    
    const timer = setInterval(() => {
      const now = new Date();
      const diff = Math.max(0, Math.floor((expiryTime.getTime() - now.getTime()) / 1000));
      
      if (diff <= 0) {
        setTimeLeft(0);
        setQrValue("");
        setQrUrl("");
        setSessionSaved(false);
        setExpiryTime(null);
        clearInterval(timer);
        toast({
          variant: "destructive",
          title: "QR Code Expired",
          description: "The QR code has expired. Please generate a new one if needed.",
        });
      } else {
        setTimeLeft(diff);
      }
    }, 1000);
    
    return () => clearInterval(timer);
  }, [expiryTime, toast]);
  
  // Format time left for display
  const formatTimeLeft = (seconds: number | null): string => {
    if (seconds === null) return "";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Format date for better consistency with database
  const formatDateForDB = (dateString: string) => {
    try {
      // Keep the date in YYYY-MM-DD format
      return dateString;
    } catch (e) {
      console.error("Error formatting date:", e);
      return dateString;
    }
  };

  // Format time for better consistency with database
  const formatTimeForDB = (timeString: string) => {
    try {
      // Keep the time in HH:MM format
      return timeString;
    } catch (e) {
      console.error("Error formatting time:", e);
      return timeString;
    }
  };

  // New improved session creation that directly inserts using Supabase
  const createAndBroadcastSession = async (sessionData) => {
    try {
      console.log("QR Generator: Creating session with data:", sessionData);

      // First, deactivate all existing active sessions to ensure only one active session
      console.log("QR Generator: Deactivating all existing active sessions");
      const { error: deactivateError } = await supabase
        .from('sessions')
        .update({ is_active: false })
        .eq('is_active', true);
      
      if (deactivateError) {
        console.warn("QR Generator: Failed to deactivate existing sessions:", deactivateError);
        throw deactivateError;
      }
      
      console.log("QR Generator: Successfully deactivated existing sessions");

      // Insert the new session
      const { data: insertedSession, error: insertError } = await supabase
        .from('sessions')
        .insert(sessionData)
        .select('*')
        .single();

      if (insertError) {
        console.error("QR Generator: Session insertion error:", insertError);
        throw insertError;
      }

      console.log("QR Generator: Session inserted successfully:", insertedSession);

      // Broadcast the change using multiple methods
      // Method 1: Custom event
      try {
        const event = new CustomEvent('session-created', {
          detail: { sessionId: insertedSession.id, timestamp: Date.now() }
        });
        window.dispatchEvent(event);
        console.log("QR Generator: Custom event dispatched");
      } catch (e) {
        console.warn("QR Generator: Custom event dispatch failed:", e);
      }

      // Method 2: React Query global cache update
      try {
        // Update the React Query cache directly
        queryClient.setQueryData(['/api/sessions/active'], {
          success: true,
          data: insertedSession
        });
        console.log("QR Generator: React Query cache updated");
      } catch (e) {
        console.warn("QR Generator: React Query update failed:", e);
      }

      // Method 3: Force all browser tabs to update
      try {
        // Use localStorage to notify other tabs
        localStorage.setItem('latest_active_session', JSON.stringify({
          id: insertedSession.id,
          timestamp: Date.now()
        }));
        console.log("QR Generator: LocalStorage updated for cross-tab communication");
      } catch (e) {
        console.warn("QR Generator: LocalStorage update failed:", e);
      }

      return insertedSession;
    } catch (error) {
      console.error("QR Generator: Error creating session:", error);
      throw error;
    }
  };

  // Update the onSubmit function to use the new direct session creation
  const onSubmit = async (data: FormValues) => {
    try {
      setIsSubmitting(true);
      setSessionSaved(false);
      setErrorMessage(null);

      // Format date and time for consistency
      const formattedDate = formatDateForDB(data.date);
      const formattedTime = formatTimeForDB(data.time);

      // Generate a unique session ID
      const sessionId = uuidv4();

      // Create QR data object with formatted date and time
      const qrData = {
        sessionId: sessionId,
        name: data.name,
        date: formattedDate,
        time: formattedTime,
        duration: data.duration,
        generatedAt: new Date().toISOString(),
        expiresAfter: 10 // QR code expires after 10 minutes
      };

      // Convert to string for QR code
      const qrString = JSON.stringify(qrData);
      setQrValue(qrString);

      // Generate QR code URL for download
      const url = await QRCode.toDataURL(qrString);
      setQrUrl(url);

      // Set expiration time to 10 minutes from now (QR code expiration)
      const qrExpirationDate = new Date();
      qrExpirationDate.setMinutes(qrExpirationDate.getMinutes() + 10);

      // Set expiry time for countdown
      setExpiryTime(qrExpirationDate);

      // Format expires_at as ISO string without milliseconds for PostgreSQL compatibility
      const expiresAt = qrExpirationDate.toISOString().replace(/\.\d{3}Z$/, 'Z');

      // Prepare the data for insertion
      const sessionData = {
        name: data.name,
        date: formattedDate,
        time: formattedTime,
        duration: data.duration, // Keep original duration for session length
        qr_code: qrString,
        expires_at: expiresAt, // QR code expires after 10 minutes
        is_active: true, // Explicitly set to active
        created_at: new Date().toISOString() // Ensure created_at is set
      };

      // Create the session and broadcast the change
      const session = await createAndBroadcastSession(sessionData);
      
      // If we got this far, the session was created successfully
      setSessionSaved(true);
      
      // Refresh the sessions list
      refetchSessions();

      toast({
        title: "QR Code Generated",
        description: "The QR code has been generated and the session has been saved.",
      });
    } catch (error) {
      console.error("QR Generator: Error in form submission:", error);
      setErrorMessage("Failed to save session. Please try again.");
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to generate QR code or save session.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const downloadQR = () => {
    if (!qrUrl) return;

    const link = document.createElement("a");
    link.href = qrUrl;
    link.download = `qrcode-${form.getValues().name.replace(/\s+/g, "-")}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">QR Code Generator</h2>
      </div>

      {errorMessage && (
        <div className="bg-destructive/15 text-destructive p-4 rounded-md mb-4">
          <h3 className="font-medium">Error Occurred</h3>
          <p className="text-sm">{errorMessage}</p>
          <p className="text-sm mt-2">Please check your data and try again.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Create New Session</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Session Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter session name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="time"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Time</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="duration"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Duration (minutes)</FormLabel>
                      <FormControl>
                        <Input type="number" min="1" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <QrCodeIcon className="mr-2 h-4 w-4" /> Generate QR Code
                    </>
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">QR Code Output</CardTitle>
          </CardHeader>
          <CardContent>
            {qrValue ? (
              <div className="flex flex-col items-center space-y-4">
                <div
                  ref={qrRef}
                  className="w-64 h-64 border-4 border-primary p-2 rounded-lg flex items-center justify-center relative"
                >
                  <QRCodeSVG
                    value={qrValue}
                    size={240}
                    level="H"
                    includeMargin={true}
                  />
                  {timeLeft !== null && (
                    <div className="absolute -top-4 -right-4 bg-yellow-500 text-white font-bold rounded-full w-12 h-12 flex items-center justify-center shadow-md">
                      {formatTimeLeft(timeLeft)}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button onClick={downloadQR} className="flex items-center">
                    <Download className="mr-2 h-4 w-4" /> Download QR Code
                  </Button>
                  {sessionSaved && (
                    <div className="flex items-center text-sm text-green-500 font-medium">
                      <Check className="h-4 w-4 mr-1" /> Saved to database
                    </div>
                  )}
                </div>
                {timeLeft !== null && (
                  <div className="text-sm text-muted-foreground text-center">
                    This QR code will expire in <span className="font-medium text-yellow-600">{formatTimeLeft(timeLeft)}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <QrCodeIcon className="h-16 w-16 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  Generate a QR code to see the output here
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
