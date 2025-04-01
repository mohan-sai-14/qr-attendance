import { createServer } from 'http';
import { parse } from 'url';
import { createReadStream } from 'fs';
import path from 'path';
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import { fileURLToPath } from 'url';

// Importing your server code
import '../app/dist/server.js';

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(cors());
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'd8e015a7f9e3b2c4a1d6e9f8b7c0a3d2',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production' }
}));

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, '../app/dist/public')));

// Serve the index.html for any request not found
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../app/dist/public/index.html'));
});

export default app; 