import express from 'express';
import cors from 'cors';
import session from 'express-session';
import passport from 'passport';
import { registerRoutes } from './routes';
import path from 'path';

const app = express();
const port = process.env.PORT || 3000;

// CORS configuration
app.use(cors({
  origin: 'http://localhost:5173', // Vite's default port
  credentials: true
}));

// JSON parsing
app.use(express.json());

// Session configuration
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Passport initialization
app.use(passport.initialize());
app.use(passport.session());

// Global middleware to set JSON content type
app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json');
  next();
});

// Register all routes
registerRoutes(app);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Global error handler:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${port}`);
}); 