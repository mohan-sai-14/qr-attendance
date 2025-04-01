import { motion } from "framer-motion";
import LoginForm from "@/components/login-form";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useEffect, useState } from "react";

// Define types for the animated balls
type Ball = {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  duration: number;
  delay: number;
  xMovement: number;
  yMovement: number;
};

export default function Login() {
  const [balls, setBalls] = useState<Ball[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Generate random balls on component mount
  useEffect(() => {
    const colors = [
      "bg-neon-blue/20", 
      "bg-neon-purple/15", 
      "bg-primary/10", 
      "bg-neon-cyan/15", 
      "bg-indigo-500/15",
      "bg-blue-400/15"
    ];
    
    const newBalls = Array.from({ length: 15 }, (_, i) => ({
      id: i,
      x: Math.random() * 100, // random position as percentage of viewport
      y: Math.random() * 100,
      size: Math.random() * 8 + 2, // random size between 2 and 10
      color: colors[Math.floor(Math.random() * colors.length)],
      duration: Math.random() * 25 + 15, // random duration between 15 and 40 seconds
      delay: Math.random() * 5, // random delay for animation start
      xMovement: Math.random() * 60 - 30, // random x movement between -30 and 30
      yMovement: Math.random() * 60 - 30, // random y movement between -30 and 30
    }));
    
    setBalls(newBalls);
    
    // Set page as loaded after a small delay for the entrance animation
    setTimeout(() => setIsLoaded(true), 300);
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
      className="min-h-screen relative overflow-hidden flex flex-col items-center justify-center p-4 bg-gradient-to-br from-background to-background/90 dark:from-background dark:to-slate-900"
    >
      {/* Theme Toggle - Moved to top right */}
      <motion.div 
        className="absolute top-4 right-4 z-20"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <ThemeToggle />
      </motion.div>
      
      {/* Abstract Background Elements */}
      <div className="absolute inset-0 overflow-hidden z-0">
        <motion.div 
          className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 dark:bg-neon-blue/5 rounded-full blur-3xl transform -translate-y-1/2"
          animate={{
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 20,
            ease: "easeInOut",
            repeat: Infinity,
          }}
        />
        <motion.div 
          className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 dark:bg-neon-purple/5 rounded-full blur-3xl transform translate-y-1/2"
          animate={{
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: 25,
            ease: "easeInOut",
            repeat: Infinity,
          }}
        />
        
        {/* Animated Moving Balls */}
        {balls.map((ball) => (
          <motion.div
            key={ball.id}
            className={`absolute rounded-full ${ball.color}`}
            style={{
              width: `${ball.size}rem`,
              height: `${ball.size}rem`,
              left: `${ball.x}%`,
              top: `${ball.y}%`,
              filter: "blur(3px)",
            }}
            initial={{ opacity: 0 }}
            animate={{ 
              x: [0, ball.xMovement, 0],
              y: [0, ball.yMovement, 0],
              opacity: [0.2, 0.7, 0.2],
            }}
            transition={{
              duration: ball.duration,
              ease: "easeInOut",
              repeat: Infinity,
              delay: ball.delay,
              repeatType: "reverse",
            }}
          />
        ))}
        
        {/* Original Animated Particles */}
        <motion.div 
          className="absolute top-1/4 left-1/3 w-4 h-4 bg-neon-blue/30 rounded-full"
          animate={{
            y: [0, 100, 0],
            opacity: [0.3, 0.8, 0.3],
            boxShadow: [
              "0 0 0 0 rgba(59, 130, 246, 0)",
              "0 0 20px 5px rgba(59, 130, 246, 0.3)",
              "0 0 0 0 rgba(59, 130, 246, 0)"
            ]
          }}
          transition={{
            duration: 15,
            ease: "easeInOut",
            repeat: Infinity,
          }}
        />
        <motion.div 
          className="absolute top-2/3 right-1/3 w-6 h-6 bg-neon-purple/30 rounded-full"
          animate={{
            y: [0, -120, 0],
            opacity: [0.2, 0.7, 0.2],
            boxShadow: [
              "0 0 0 0 rgba(147, 51, 234, 0)",
              "0 0 25px 5px rgba(147, 51, 234, 0.3)",
              "0 0 0 0 rgba(147, 51, 234, 0)"
            ]
          }}
          transition={{
            duration: 18,
            ease: "easeInOut",
            repeat: Infinity,
          }}
        />
        <motion.div 
          className="absolute top-1/2 left-1/4 w-3 h-3 bg-neon-cyan/30 rounded-full"
          animate={{
            x: [0, 80, 0],
            opacity: [0.4, 0.9, 0.4],
            boxShadow: [
              "0 0 0 0 rgba(34, 211, 238, 0)",
              "0 0 15px 5px rgba(34, 211, 238, 0.3)",
              "0 0 0 0 rgba(34, 211, 238, 0)"
            ]
          }}
          transition={{
            duration: 20,
            ease: "easeInOut",
            repeat: Infinity,
          }}
        />
      </div>
      
      {/* Main Content with entrance animation */}
      <motion.div 
        className="z-10 w-full max-w-lg"
        initial={{ opacity: 0, y: 20 }}
        animate={{ 
          opacity: isLoaded ? 1 : 0, 
          y: isLoaded ? 0 : 20,
        }}
        transition={{ delay: 0.3, duration: 0.5 }}
      >
        <LoginForm />
      </motion.div>
      
      {/* Rings animation around login */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-5">
        <motion.div 
          className="w-[700px] h-[700px] border border-neon-blue/10 rounded-full"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, delay: 0.7 }}
        />
        <motion.div 
          className="absolute w-[600px] h-[600px] border border-neon-purple/10 rounded-full"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, delay: 0.9 }}
        />
        <motion.div 
          className="absolute w-[500px] h-[500px] border border-neon-cyan/10 rounded-full"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, delay: 1.1 }}
        />
      </div>
      
      {/* Footer */}
      <motion.div
        className="absolute bottom-4 text-center text-xs text-foreground/30 z-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
      >
        <p>TU Robotics Club © {new Date().getFullYear()} | Takshashila University</p>
      </motion.div>
    </motion.div>
  );
}
