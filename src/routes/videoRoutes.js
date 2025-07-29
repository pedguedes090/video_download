import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { VideoController } from '../controllers/videoController.js';

const router = express.Router();
const videoController = new VideoController();

// Validation middleware
const validateUrl = [
  body('url')
    .isURL()
    .withMessage('Please provide a valid URL')
    .notEmpty()
    .withMessage('URL is required'),
];

const validateStreamUrl = [
  query('url')
    .isURL()
    .withMessage('Please provide a valid URL')
    .notEmpty()
    .withMessage('URL is required'),
];

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

// Routes

// Get API documentation
router.get('/', (req, res) => {
  res.json({
    message: 'Video Downloader API',
    endpoints: {
      'GET /info': 'Get video information',
      'POST /download': 'Download video',
      'GET /stream': 'Stream video',
      'GET /thumbnails': 'Get video thumbnails',
      'GET /title': 'Get video title',
      'POST /file': 'Get video file without saving to disk',
      'GET /downloads': 'List downloaded files'
    },
    examples: {
      getInfo: 'POST /api/video/info with body: {"url": "https://youtube.com/watch?v=..."}',
      download: 'POST /api/video/download with body: {"url": "...", "format": "mp4", "quality": "720p"}',
      stream: 'GET /api/video/stream?url=https://youtube.com/watch?v=...'
    }
  });
});

// Get video information
router.post('/info', validateUrl, handleValidationErrors, videoController.getInfo);

// Get video information (GET method for convenience)
router.get('/info', validateStreamUrl, handleValidationErrors, async (req, res, next) => {
  try {
    // Convert query parameter to body format for the controller
    req.body = { url: req.query.url };
    await videoController.getInfo(req, res, next);
  } catch (error) {
    next(error);
  }
});

// Download video
router.post('/download', validateUrl, handleValidationErrors, videoController.downloadVideo);

// Stream video
router.get('/stream', validateStreamUrl, handleValidationErrors, videoController.streamVideo);

// Get thumbnails
router.post('/thumbnails', validateUrl, handleValidationErrors, videoController.getThumbnails);

// Get thumbnail image via browserUrl
router.get('/thumbnail/:videoId', videoController.getThumbnailImage);

// Get title
router.post('/title', validateUrl, handleValidationErrors, videoController.getTitle);

// Get file without saving
router.post('/file', validateUrl, handleValidationErrors, videoController.getFile);

// Check installation
router.get('/check-installation', videoController.checkInstallation);

// List downloaded files
router.get('/downloads', videoController.listDownloads);

export { router as videoRoutes };
