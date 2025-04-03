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
      onSuccess(result.redirectUrl || '/student');
      
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