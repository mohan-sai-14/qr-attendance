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
      code: sessionId || ""
    }
  });

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    try {
      setIsSubmitting(true);
      
      if (!user) {
        throw new Error("You must be logged in to record attendance");
      }
      
      // Validate the session exists and is active
      const { data: session, error: sessionError } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', data.code)
        .eq('is_active', true)
        .single();
      
      if (sessionError || !session) {
        throw new Error("Invalid or inactive session");
      }
      
      // Check if attendance already recorded
      const { data: existingAttendance, error: attendanceError } = await supabase
        .from('attendance')
        .select('*')
        .eq('session_id', data.code)
        .eq('user_id', user.id)
        .single();
      
      if (existingAttendance) {
        toast({
          title: "Already Recorded",
          description: "Your attendance for this session has already been recorded.",
        });
        return;
      }
      
      // Record attendance
      const now = new Date();
      const { error: insertError } = await supabase
        .from('attendance')
        .insert([{
          session_id: data.code,
          user_id: user.id,
          username: user.username,
          name: user.name,
          check_in_time: now.toISOString(),
          date: now.toISOString().split('T')[0],
          status: 'present'
        }]);
      
      if (insertError) {
        throw insertError;
      }
      
      toast({
        title: "Success",
        description: "Attendance recorded successfully!",
      });
      
      // Redirect to dashboard
      onSuccess('/student');
      
    } catch (error: any) {
      console.error("Error recording attendance:", error);
      onError(error.message || "Failed to record attendance");
      
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to record attendance",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
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
          {isSubmitting ? "Recording..." : "Submit"}
        </Button>
      </form>
    </Form>
  );
};

export default AttendanceCodeInput; 