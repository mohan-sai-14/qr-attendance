import express, { Request, Response, NextFunction } from 'express';
import session from 'express-session';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { router } from './src/routes';

// Load environment variables
dotenv.config();

const app = express();

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Add security headers
app.use((req: Request, res: Response, next: NextFunction) => {
  // Content Security Policy
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; font-src 'self' data:; img-src 'self' data:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
  );
  
  // Log all incoming requests
  console.log(`${req.method} ${req.path}`);
  next();
});

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax'
  }
}));

// API routes
app.use('/api', router);

// Serve static files
const publicPath = path.join(process.cwd(), 'dist', 'public');
app.use(express.static(publicPath, {
  maxAge: '1h',
  index: false // Don't serve index.html for directory requests
}));

// Health check route
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

// Catch-all route for client-side routing
app.get('*', (req: Request, res: Response) => {
  if (req.url.startsWith('/api/')) {
    return res.status(404).json({ 
      error: 'Not found',
      details: 'The requested API endpoint does not exist'
    });
  }
  
  // For non-API routes, serve the index.html for client-side routing
  const indexPath = path.join(publicPath, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      console.error('Error sending index.html:', err);
      res.status(500).send('Error loading application');
    }
  });
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    details: err.message || 'An unexpected error occurred'
  });
});

const port = process.env.PORT || 3000;

if (process.env.NODE_ENV !== 'production') {
  app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
  });
}

export default app;
