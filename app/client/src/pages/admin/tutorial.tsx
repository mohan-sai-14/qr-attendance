import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, BookOpen, Video, FileText, Code } from "lucide-react";

export default function Tutorial() {
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  
  const toggleComplete = (stepId: string) => {
    setCompletedSteps(prev => 
      prev.includes(stepId) 
        ? prev.filter(id => id !== stepId)
        : [...prev, stepId]
    );
  };
  
  const isCompleted = (stepId: string) => completedSteps.includes(stepId);
  
  const tutorials = [
    {
      id: "getting-started",
      title: "Getting Started",
      icon: <BookOpen className="w-5 h-5" />,
      content: [
        {
          id: "intro",
          title: "Introduction to the System",
          description: "Learn about the basic features and functions of the attendance system.",
          type: "doc"
        },
        {
          id: "setup",
          title: "Initial Setup",
          description: "Configure your administrative account and understand the dashboard.",
          type: "interactive"
        }
      ]
    },
    {
      id: "creating-sessions",
      title: "Creating Sessions",
      icon: <Code className="w-5 h-5" />,
      content: [
        {
          id: "create-session",
          title: "Creating a New Session",
          description: "Learn how to create and configure attendance sessions.",
          type: "video"
        },
        {
          id: "qr-generation",
          title: "QR Code Generation",
          description: "Generate and manage QR codes for taking attendance.",
          type: "interactive"
        }
      ]
    },
    {
      id: "managing-attendance",
      title: "Managing Attendance",
      icon: <FileText className="w-5 h-5" />,
      content: [
        {
          id: "attendance-viewing",
          title: "Viewing Attendance Records",
          description: "Navigate and filter attendance records for various sessions.",
          type: "doc"
        },
        {
          id: "attendance-export",
          title: "Exporting Attendance Data",
          description: "Export attendance records in various formats for reporting.",
          type: "interactive"
        }
      ]
    },
    {
      id: "student-management",
      title: "Student Management",
      icon: <Video className="w-5 h-5" />,
      content: [
        {
          id: "adding-students",
          title: "Adding Students",
          description: "Add and manage student profiles in the system.",
          type: "video"
        },
        {
          id: "student-groups",
          title: "Creating Student Groups",
          description: "Organize students into groups for easier management.",
          type: "interactive"
        }
      ]
    }
  ];
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tutorial Center</h1>
          <p className="text-muted-foreground">
            Learn how to use all features of the attendance system.
          </p>
        </div>
      </div>
      
      <Tabs defaultValue="getting-started" className="space-y-6">
        <TabsList className="grid grid-cols-4 w-full max-w-3xl">
          {tutorials.map(tutorial => (
            <TabsTrigger 
              key={tutorial.id} 
              value={tutorial.id}
              className="flex items-center gap-2"
            >
              {tutorial.icon}
              <span className="hidden sm:inline">{tutorial.title}</span>
            </TabsTrigger>
          ))}
        </TabsList>
        
        {tutorials.map(tutorial => (
          <TabsContent key={tutorial.id} value={tutorial.id} className="space-y-4">
            <h2 className="text-xl font-semibold mb-4">{tutorial.title}</h2>
            
            <div className="grid gap-4 md:grid-cols-2">
              {tutorial.content.map(item => (
                <Card key={item.id} className="overflow-hidden transition-all hover:shadow-md">
                  <CardHeader className="bg-muted/50 pb-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-base">{item.title}</CardTitle>
                        <CardDescription className="text-xs mt-1">
                          {item.description}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          item.type === 'video' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                          item.type === 'doc' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                          'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        }`}>
                          {item.type === 'video' ? 'Video' : 
                           item.type === 'doc' ? 'Documentation' : 
                           'Interactive'}
                        </span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <div className="flex justify-between items-center">
                      <Button 
                        variant="outline" 
                        size="sm"
                      >
                        {item.type === 'video' ? 'Watch Video' : 
                         item.type === 'doc' ? 'Read Documentation' : 
                         'Start Tutorial'}
                      </Button>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        className={`px-2 ${isCompleted(item.id) ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}
                        onClick={() => toggleComplete(item.id)}
                      >
                        <CheckCircle className={`h-5 w-5 ${isCompleted(item.id) ? 'fill-green-600 dark:fill-green-400' : ''}`} />
                        <span className="sr-only">
                          {isCompleted(item.id) ? 'Mark as incomplete' : 'Mark as complete'}
                        </span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            
            {tutorial.id === "getting-started" && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="p-4 mt-6 bg-muted/50 rounded-lg border border-border"
              >
                <h3 className="text-lg font-medium mb-2">Quick Tips for Beginners</h3>
                <ul className="space-y-2 ml-5 list-disc text-sm text-muted-foreground">
                  <li>Explore the dashboard to get familiar with the navigation</li>
                  <li>Create a test session to practice QR code generation</li>
                  <li>Check the reports section to see how attendance data is presented</li>
                  <li>Use the search feature to quickly find specific students or sessions</li>
                </ul>
              </motion.div>
            )}
          </TabsContent>
        ))}
      </Tabs>
      
      <div className="mt-8 p-6 border rounded-lg bg-muted/30">
        <h3 className="text-lg font-medium mb-3">Your Learning Progress</h3>
        <div className="w-full bg-muted rounded-full h-2.5 mb-2">
          <div 
            className="bg-gradient-to-r from-neon-blue to-neon-purple h-2.5 rounded-full" 
            style={{ width: `${(completedSteps.length / (tutorials.flatMap(t => t.content).length)) * 100}%` }}
          ></div>
        </div>
        <p className="text-sm text-muted-foreground">
          {completedSteps.length} of {tutorials.flatMap(t => t.content).length} lessons completed
          ({Math.round((completedSteps.length / (tutorials.flatMap(t => t.content).length)) * 100)}%)
        </p>
      </div>
    </div>
  );
} 