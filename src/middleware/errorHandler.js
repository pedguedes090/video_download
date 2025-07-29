export const errorHandler = (err, req, res, next) => {
  console.error('Error occurred:', err);

  // Default error
  let error = {
    message: err.message || 'Internal Server Error',
    status: err.status || 500
  };

  // YtDlp specific errors
  if (err.message.includes('yt-dlp')) {
    error.status = 400;
    error.message = 'Video download failed: ' + err.message;
  }

  // URL validation errors
  if (err.message.includes('Invalid URL') || err.message.includes('not available')) {
    error.status = 400;
    error.message = 'Invalid or unavailable video URL';
  }

  // Network errors
  if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') {
    error.status = 503;
    error.message = 'Service temporarily unavailable';
  }

  // File system errors
  if (err.code === 'ENOENT') {
    error.status = 500;
    error.message = 'File system error occurred';
  }

  // Send error response
  res.status(error.status).json({
    success: false,
    error: error.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};
