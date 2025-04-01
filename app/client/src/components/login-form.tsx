import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

const formSchema = z.object({
  username: z.string().min(1, {
    message: "Username is required",
  }),
  password: z.string().min(1, {
    message: "Password is required",
  }),
});

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: { 
      when: "beforeChildren",
      staggerChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: { 
    y: 0, 
    opacity: 1,
    transition: { type: "spring", stiffness: 300, damping: 24 }
  }
};

export default function LoginForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [usingFallback, setUsingFallback] = useState(false);
  const { login } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("student");
  const [logoError, setLogoError] = useState(false);

  // Auto-fill credentials based on active tab
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    // Remove auto-fill functionality
    form.setValue("username", "");
    form.setValue("password", "");
  };

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: "",  // No default values
      password: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    setLoginError(null);
    setUsingFallback(false);
    
    try {
      console.log("Submitting login form for:", values.username);
      const userData = await login(values.username, values.password);
      
      // Check if using fallback login
      if (userData && !userData.id && values.username === "S1001" || values.username === "admin") {
        setUsingFallback(true);
        toast({
          title: "Login successful (offline mode)",
          description: "Connected in limited functionality mode",
        });
      } else {
        toast({
          title: "Login successful",
          description: `Welcome back, ${userData.name}!`,
        });
      }
      // Auth redirection is handled in the App component
    } catch (error: any) {
      console.error("Login form error:", error);
      
      // Check for specific error types
      let errorMessage: string;
      
      if (error.message?.includes("Server returned invalid format")) {
        errorMessage = "Server error. Please contact support.";
      } else if (error.message?.includes("Network Error") || !navigator.onLine) {
        errorMessage = "Network error. Check your internet connection.";
      } else {
        errorMessage = error.message || "Invalid credentials. Please try again.";
      }
      
      // Set the login error message for display
      setLoginError(errorMessage);
      
      toast({
        variant: "destructive",
        title: "Login failed",
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="w-full"
    >
      <Card className="backdrop-blur-md bg-background/80 border border-border/50 shadow-lg">
        <CardHeader className="text-center">
          <motion.div 
            className="flex justify-center mb-4"
            variants={itemVariants}
          >
            <motion.div 
              className="w-28 h-28 rounded-full overflow-hidden shadow-lg flex items-center justify-center bg-white"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {logoError ? (
                // SVG fallback
                <img 
                  src="/robotics-logo.svg" 
                  alt="TU Robotics Club Logo" 
                  className="w-full h-full object-contain"
                />
              ) : (
                // PNG primary choice
                <img 
                  src="/robotics-logo.png" 
                  alt="TU Robotics Club Logo" 
                  className="w-full h-full object-contain"
                  onError={() => setLogoError(true)}
                />
              )}
            </motion.div>
          </motion.div>
          <motion.div variants={itemVariants}>
            <CardTitle className="text-3xl font-display font-bold bg-clip-text text-transparent bg-gradient-to-r from-neon-blue to-neon-purple">
              TU Robotics Club
            </CardTitle>
          </motion.div>
          <motion.div variants={itemVariants}>
            <CardDescription className="text-foreground/70">
              Attendance Management System
            </CardDescription>
          </motion.div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
            <motion.div variants={itemVariants}>
              <TabsList className="grid w-full grid-cols-2 mb-6 p-1 bg-background/50 backdrop-blur-md">
                <TabsTrigger 
                  value="student"
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-neon-blue/80 data-[state=active]:to-neon-purple/80 data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-300"
                >
                  Student Login
                </TabsTrigger>
                <TabsTrigger 
                  value="admin"
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-neon-blue/80 data-[state=active]:to-neon-purple/80 data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-300"
                >
                  Admin Login
                </TabsTrigger>
              </TabsList>
            </motion.div>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <motion.div 
                  className="space-y-4"
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                >
                  {loginError && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm"
                    >
                      {loginError}
                    </motion.div>
                  )}
                  
                  {usingFallback && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-700 dark:text-yellow-400 px-4 py-3 rounded-md text-sm"
                    >
                      Connected in offline mode. Some features may be limited.
                    </motion.div>
                  )}
                  
                  <motion.div variants={itemVariants}>
                    <FormField
                      control={form.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-foreground/70">
                            {activeTab === "student" ? "Student ID" : "Admin ID"}
                          </FormLabel>
                          <FormControl>
                            <Input 
                              placeholder={activeTab === "student" ? "Enter your student ID" : "Enter your admin ID"} 
                              {...field} 
                              className="input-glow bg-background/50 border border-border/50 focus:border-neon-purple/50"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </motion.div>
                  
                  <motion.div variants={itemVariants}>
                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-foreground/70">Password</FormLabel>
                          <FormControl>
                            <Input 
                              type="password" 
                              placeholder="Enter your password" 
                              {...field} 
                              className="input-glow bg-background/50 border border-border/50 focus:border-neon-purple/50"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </motion.div>
                  
                  <motion.div variants={itemVariants}>
                    <Button 
                      type="submit" 
                      className="w-full bg-gradient-to-r from-neon-blue to-neon-purple hover:from-neon-purple hover:to-neon-blue text-white transition-all duration-300 transform hover:scale-[1.02] shadow-md hover:shadow-neon-sm"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Logging in...
                        </>
                      ) : "Log in"}
                    </Button>
                  </motion.div>
                </motion.div>
              </form>
            </Form>
          </Tabs>
        </CardContent>
      </Card>
    </motion.div>
  );
}
