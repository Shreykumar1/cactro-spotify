import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import dotenv from 'dotenv';
import path from 'path';
const spotifyRoutes = require('./routes/spotifyRoutes');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env['PORT'] || 8888;

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(process.cwd(), 'public')));

// Routes
app.use('/spotify', spotifyRoutes);

// Serve the Spotify dashboard HTML
app.get('/spotify-dashboard', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'spotify.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  
  // Don't crash the server for authentication errors
  if (err.message.includes('Not authenticated') || err.message.includes('Authentication expired')) {
    return res.redirect('/spotify/login');
  }
  
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(` Server is running on port ${PORT}`);
  console.log(` Spotify API endpoint: http://localhost:${PORT}/spotify`);
  console.log(` Spotify Dashboard: http://localhost:${PORT}/spotify-dashboard`);
  console.log(` Login: http://localhost:${PORT}/spotify/login`);
});

export default app; 