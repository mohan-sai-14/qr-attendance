import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = 'https://qwavakkbfpdgkvtctogx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF3YXZha2tiZnBkZ2t2dGN0b2d4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI3MTE4MjYsImV4cCI6MjA1ODI4NzgyNn0.Kdwo9ICmcsHPhK_On6G73ccSPkcEqzAg2BtvblhD8co';
const supabase = createClient(supabaseUrl, supabaseKey);

const formSchema = z.object({
  code: z.string().min(1, "Attendance code is required")
});

interface AttendanceCodeInputProps {
  sessionId?: string;
  onSuccess: (redirectUrl: string) => void;
  onError: (message: string) => void;
}

const AttendanceCodeInput: React.FC<AttendanceCodeInputProps> = ({
  sessionId,
  onSuccess,
  onError
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      code: ""
    }
  });

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    try {
      setIsSubmitting(true);
      
      // For this demo, we'll treat the code as a direct session ID
      // In a real app, you would validate the code against the session
      const codeToUse = data.code.trim();
      
      console.log(`Submitting attendance with code: ${codeToUse}`);
      
      // First, try direct Supabase insert
      try {
        console.log("Attempting direct Supabase insert with code:", codeToUse);
        
        // Format the current date for the database record
        const now = new Date();
        const formattedDate = now.toISOString().split('T')[0]; // YYYY-MM-DD
        const localTimestamp = now.toISOString();
        
        // Insert attendance record directly to Supabase
        const { data: insertData, error: insertError } = await supabase
        .from('attendance')
        .insert([{
            session_id: codeToUse,
            user_id: user?.id || 3,
            username: user?.username || 'student',
            name: user?.name || 'Student',
          check_in_time: localTimestamp,
            date: formattedDate,
          status: 'present',
            session_name: `Session ${codeToUse}`
        }])
        .select();

      if (insertError) {
          console.error('Direct Supabase error:', insertError);
          // Continue to API fallback
        } else {
          console.log('Successfully saved attendance directly to Supabase:', insertData);
          toast({
            title: "Success",
            description: "Attendance recorded successfully!"
          });
          
          // Use baseUrl for safe navigation
          setTimeout(() => {
            const baseUrl = window.location.origin;
            window.location.href = `${baseUrl}/student`;
          }, 1500);
          
          return;
        }
      } catch (supabaseError) {
        console.error("Error with direct Supabase insert:", supabaseError);
        // Continue to API fallback
      }
      
      // Fallback to API if direct insert fails
      console.log("Falling back to API for attendance recording");
      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sessionId: codeToUse,
          userId: user?.id || 3, // Default ID if user context is not available
          username: user?.username || 'student',
          timestamp: new Date().toISOString()
        }),
        credentials: 'include'
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        console.error("Error recording attendance with code:", result);
        onError(result.error || result.message || "Failed to record attendance");
        return;
      }

      console.log("Attendance recorded successfully with code:", result);
      
      // Use baseUrl for direct navigation rather than relying on redirectUrl
      setTimeout(() => {
        const baseUrl = window.location.origin;
        window.location.href = `${baseUrl}/student`;
      }, 1500);
      
    } catch (error) {
      console.error("Error recording attendance with code:", error);
      onError("An error occurred while recording attendance. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="code"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input 
                    placeholder="Enter attendance code" 
                    {...field} 
                    disabled={isSubmitting}
                    className="text-center text-lg py-6"
                  />
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
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...
              </>
            ) : (
              "Submit Code"
            )}
          </Button>
        </form>
      </Form>
    </div>
  );
};

export default AttendanceCodeInput; 