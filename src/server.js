import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import rateLimit from 'express-rate-limit';
import { videoRoutes } from './routes/videoRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 7860;

// Helper function to get current host
const getBaseUrl = (req) => {
  const protocol = req.protocol || 'http';
  const host = req.get('host') || `localhost:${PORT}`;
  return `${protocol}://${host}`;
};

// Security middleware
app.use(helmet());
app.use(cors());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// Logging
app.use(morgan('combined'));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files
app.use(express.static('public'));
app.use('/downloads', express.static('downloads'));

// Serve index.html at root
app.get('/', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
});

// Routes
app.use('/api/video', videoRoutes);

// Health check
app.get('/health', (req, res) => {
  const baseUrl = getBaseUrl(req);
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    host: req.get('host'),
    baseUrl: baseUrl,
    port: PORT,
    environment: process.env.NODE_ENV || 'development'
  });
});

// Error handling
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  const HOST = process.env.HOST || 'localhost';
  const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
  const baseUrl = process.env.BASE_URL || `${protocol}://${HOST}:${PORT}`;
  
  console.log(`🚀 Video Downloader API is running on port ${PORT}`);
  console.log(`🌐 Server URL: ${baseUrl}`);
  console.log(`📝 Health check: ${baseUrl}/health`);
  console.log(`📹 API docs: ${baseUrl}/api/video/info`);
});

export default app;
