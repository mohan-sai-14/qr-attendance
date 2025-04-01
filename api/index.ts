import express from 'express';
import session from 'express-session';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import routes from './src/routes';

// Load environment variables
dotenv.config();

const app = express();

// CORS configuration
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Access-Control-Allow-Origin']
}));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Add security headers
app.use((req, res, next) => {
  // Content Security Policy
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; font-src 'self' data:; img-src 'self' data:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
  );
  
  // Log all incoming requests
  console.log(`${req.method} ${req.url}`, req.body);
  next();
});

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'd8e015a7f9e3b2c4a1d6e9f8b7c0a3d2',
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
app.use('/api', routes);

// Serve static files from client build directory if available
const clientBuildPath = path.join(__dirname, '../client/dist');
app.use(express.static(clientBuildPath));

// Health check route
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Catch-all route for client-side routing
app.get('*', (req, res) => {
  // Check if the request is for an API route
  if (req.url.startsWith('/api/')) {
    return res.status(404).json({ 
      error: 'Not found',
      details: 'The requested API endpoint does not exist'
    });
  }
  
  // For non-API routes, serve the index.html for client-side routing
  res.sendFile(path.join(clientBuildPath, 'index.html'));
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    details: err.message || 'An unexpected error occurred'
  });
});

const port = process.env.PORT ? parseInt(process.env.PORT) : 3001;

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
