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
import { supabase } from "@/lib/supabase"; // Import Supabase client
import { useQuery } from "@tanstack/react-query";
import { format, addMinutes, parseISO } from "date-fns"; // Add this import for date formatting

const formSchema = z.object({
  name: z.string().min(1, "Session name is required"),
  date: z.string().min(1, "Date is required"),
  time: z.string().min(1, "Time is required"),
  duration: z.coerce
    .number()
    .min(1, "Duration must be at least 1 minute")
    .max(480, "Duration cannot exceed 8 hours"),
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
      date: format(new Date(), 'yyyy-MM-dd'),
      time: format(new Date(), 'HH:mm'),
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
          title: "Session Expired",
          description: "The session has expired. Please generate a new one if needed.",
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

  const onSubmit = async (data: FormValues) => {
    try {
      setIsSubmitting(true);
      setSessionSaved(false);
      setErrorMessage(null);

      // Generate session ID
      const sessionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Calculate session end time
      const sessionDateTime = new Date(`${data.date}T${data.time}`);
      const sessionEndTime = new Date(sessionDateTime.getTime() + data.duration * 60000);

      // Create session data
      const sessionData = {
        id: sessionId,
        name: data.name,
        date: data.date,
        time: data.time,
        duration: data.duration,
        is_active: true,
        created_at: new Date().toISOString(),
        expires_at: sessionEndTime.toISOString()
      };

      // Create QR code data
      const qrData = {
        sessionId,
        name: data.name,
        date: data.date,
        time: data.time,
        duration: data.duration,
        generatedAt: new Date().toISOString(),
        expiresAt: sessionEndTime.toISOString()
      };

      // First deactivate any existing active sessions
      const { error: deactivateError } = await supabase
        .from('sessions')
        .update({ is_active: false })
        .eq('is_active', true);

      if (deactivateError) {
        throw new Error('Failed to deactivate existing sessions');
      }

      // Insert new session
      const { error: insertError } = await supabase
        .from('sessions')
        .insert([sessionData]);

      if (insertError) {
        throw new Error('Failed to create new session');
      }

      // Generate QR code
      const qrString = JSON.stringify(qrData);
      setQrValue(qrString);

      // Generate QR code URL for download
      const url = await QRCode.toDataURL(qrString);
      setQrUrl(url);

      // Set expiry time for countdown
      setExpiryTime(sessionEndTime);
      setSessionSaved(true);

      // Refresh sessions list
      refetchSessions();

      toast({
        title: "Session Created",
        description: `New session "${data.name}" has been created and will end at ${format(sessionEndTime, 'HH:mm')}`,
      });
    } catch (error) {
      console.error('Error creating session:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to create session');
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create session. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const downloadQR = () => {
    if (!qrUrl) {
      toast({
        variant: "destructive",
        title: "Download Failed",
        description: "QR code is not available for download. Please generate it first.",
      });
      return;
    }

    try {
      console.log("Downloading QR code...");
      
      // Create a link element
      const link = document.createElement("a");
      link.href = qrUrl;
      link.download = `qrcode-${form.getValues().name.replace(/\s+/g, "-")}.png`;
      
      // Append to the document
      document.body.appendChild(link);
      
      // Trigger download
      link.click();
      
      // Clean up
      document.body.removeChild(link);
      
      toast({
        title: "Download Started",
        description: "Your QR code is being downloaded.",
      });
    } catch (error) {
      console.error("Error downloading QR code:", error);
      toast({
        variant: "destructive",
        title: "Download Failed",
        description: "Failed to download QR code. Please try again.",
      });
    }
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
