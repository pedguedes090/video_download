import { YtDlp } from 'ytdlp-nodejs';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import https from 'https';
import http from 'http';

export class VideoController {
  constructor() {
    this.ytdlp = new YtDlp();
    this.fileCleanupTimers = new Map(); // Track cleanup timers
    this.thumbnailCache = new Map(); // Cache thumbnails with video ID
  }

  // Helper method để tạo base URL từ request
  getBaseUrl(req) {
    const protocol = req.protocol || 'http';
    const host = req.get('host') || `localhost:${process.env.PORT || 3000}`;
    return `${protocol}://${host}`;
  }

  // Helper method để tạo tên file ngẫu nhiên
  generateRandomFileName(originalExtension = 'mp4') {
    return `${randomUUID()}.${originalExtension}`;
  }

  // Helper method để tạo video ID
  generateVideoId() {
    return randomUUID();
  }

  // Helper method để download thumbnail
  async downloadThumbnail(thumbnailUrl, videoId) {
    return new Promise((resolve, reject) => {
      const protocol = thumbnailUrl.startsWith('https') ? https : http;
      
      protocol.get(thumbnailUrl, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download thumbnail: ${response.statusCode}`));
          return;
        }

        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => {
          const buffer = Buffer.concat(chunks);
          
          // Store in cache
          this.thumbnailCache.set(videoId, {
            buffer: buffer,
            contentType: response.headers['content-type'] || 'image/jpeg',
            timestamp: Date.now()
          });
          
          // Schedule cleanup after 5 minutes
          setTimeout(() => {
            this.thumbnailCache.delete(videoId);
            console.log(`🗑️ Thumbnail cache cleaned for: ${videoId}`);
          }, 5 * 60 * 1000);
          
          resolve(buffer);
        });
        response.on('error', reject);
      }).on('error', reject);
    });
  }

  // Helper method để schedule file deletion
  scheduleFileDeletion(filePath, fileName) {
    const timerId = setTimeout(() => {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`✅ Deleted file: ${fileName}`);
        }
        this.fileCleanupTimers.delete(fileName);
      } catch (error) {
        console.error(`❌ Error deleting file ${fileName}:`, error);
      }
    }, 5 * 60 * 1000); // 5 minutes

    this.fileCleanupTimers.set(fileName, timerId);
    console.log(`⏰ Scheduled deletion for file: ${fileName} in 5 minutes`);
  }

  // Helper method để extract file size từ output
  extractFileSize(output) {
    try {
      const sizeMatch = output.match(/"total":"(\d+)"/);
      if (sizeMatch) {
        const bytes = parseInt(sizeMatch[1]);
        return {
          bytes: bytes,
          readable: this.formatFileSize(bytes)
        };
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  // Helper method để format file size
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Get video information
  getInfo = async (req, res, next) => {
    try {
      const { url, flatPlaylist = true } = req.body;
      
      console.log(`Getting info for: ${url}`);
      
      const info = await this.ytdlp.getInfoAsync(url, { flatPlaylist });
      
      res.json({
        success: true,
        data: info,
        type: info._type || 'video'
      });
    } catch (error) {
      next(error);
    }
  };

  // Download video
  downloadVideo = async (req, res, next) => {
    try {
      const { 
        url, 
        format = 'best', 
        quality = 'highest'
      } = req.body;

      console.log(`Downloading video: ${url}`);

      // Create downloads directory if it doesn't exist
      const downloadsDir = path.resolve('./downloads');
      if (!fs.existsSync(downloadsDir)) {
        fs.mkdirSync(downloadsDir, { recursive: true });
      }

      // Get video info first to determine file extension and thumbnail
      const info = await this.ytdlp.getInfoAsync(url, { flatPlaylist: true });
      
      // Generate unique video ID
      const videoId = this.generateVideoId();
      
      // Download and cache thumbnail
      let thumbnailBrowserUrl = null;
      if (info.thumbnail) {
        try {
          await this.downloadThumbnail(info.thumbnail, videoId);
          const baseUrl = this.getBaseUrl(req);
          thumbnailBrowserUrl = `${baseUrl}/api/video/thumbnail/${videoId}`;
          console.log(`📸 Thumbnail cached for video: ${videoId}`);
        } catch (error) {
          console.warn('Failed to cache thumbnail:', error.message);
        }
      }
      
      // Determine file extension based on format
      let extension = 'mp4';
      if (format === 'mp3' || (typeof format === 'object' && format.type === 'mp3')) {
        extension = 'mp3';
      } else if (format === 'webm') {
        extension = 'webm';
      }

      // Generate random filename
      const randomFileName = this.generateRandomFileName(extension);
      const outputPath = path.join(downloadsDir, randomFileName);

      let formatOptions;
      if (typeof format === 'string') {
        if (format === 'mp3') {
          formatOptions = 'bestaudio[ext=m4a]/bestaudio/best';
        } else {
          formatOptions = format;
        }
      } else {
        formatOptions = {
          filter: format.filter || 'audioandvideo',
          quality: format.quality || quality,
          type: format.type || 'mp4'
        };
      }

      const downloadOptions = {
        format: formatOptions,
        output: outputPath,
        onProgress: (progress) => {
          console.log(`Download progress: ${progress.percent}%`);
        }
      };

      // Add audio extraction for mp3
      if (format === 'mp3') {
        downloadOptions.extractAudio = true;
        downloadOptions.audioFormat = 'mp3';
        downloadOptions.audioQuality = '192K';
      }

      const result = await this.ytdlp.downloadAsync(url, downloadOptions);

      // Check if file exists
      if (!fs.existsSync(outputPath)) {
        throw new Error('Download completed but file not found');
      }

      // Get file stats
      const stats = fs.statSync(outputPath);
      
      // Schedule file deletion after 5 minutes
      this.scheduleFileDeletion(outputPath, randomFileName);

      const baseUrl = this.getBaseUrl(req);
      const browserUrl = `${baseUrl}/downloads/${encodeURIComponent(randomFileName)}`;
      
      res.json({
        success: true,
        message: 'Video downloaded successfully',
        data: {
          videoId: videoId,
          fileName: randomFileName,
          originalTitle: info.title || 'Unknown Title',
          filePath: outputPath,
          fullPath: path.resolve(outputPath),
          downloadCompleted: true,
          size: {
            bytes: stats.size,
            readable: this.formatFileSize(stats.size)
          },
          browserUrl: browserUrl,
          thumbnail: thumbnailBrowserUrl || info.thumbnail, // Use browserUrl for thumbnail if available
          thumbnailBrowserUrl: thumbnailBrowserUrl,
          duration: info.duration || null,
          expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5 minutes from now
        },
        rawOutput: result
      });
    } catch (error) {
      next(error);
    }
  };

  // Stream video
  streamVideo = async (req, res, next) => {
    try {
      const { url, format = 'best' } = req.query;

      console.log(`Streaming video: ${url}`);

      let formatOptions;
      if (typeof format === 'string') {
        formatOptions = format;
      } else {
        formatOptions = {
          filter: 'audioandvideo',
          quality: 'highest',
          type: 'mp4'
        };
      }

      const stream = this.ytdlp.stream(url, {
        format: formatOptions,
        onProgress: (progress) => {
          console.log(`Stream progress: ${progress.percent}%`);
        }
      });

      // Set appropriate headers
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Content-Disposition', 'inline');

      // Pipe the stream to response
      await stream.pipeAsync(res);
    } catch (error) {
      next(error);
    }
  };

  // Get thumbnails
  getThumbnails = async (req, res, next) => {
    try {
      const { url } = req.body;
      
      console.log(`Getting thumbnails for: ${url}`);
      
      const thumbnails = await this.ytdlp.getThumbnailsAsync(url);
      
      res.json({
        success: true,
        data: thumbnails,
        count: thumbnails.length
      });
    } catch (error) {
      next(error);
    }
  };

  // Get thumbnail image via browserUrl
  getThumbnailImage = async (req, res, next) => {
    try {
      const { videoId } = req.params;
      
      const cachedThumbnail = this.thumbnailCache.get(videoId);
      
      if (!cachedThumbnail) {
        return res.status(404).json({
          success: false,
          error: 'Thumbnail not found or expired'
        });
      }
      
      // Set appropriate headers
      res.setHeader('Content-Type', cachedThumbnail.contentType);
      res.setHeader('Cache-Control', 'public, max-age=300'); // 5 minutes cache
      res.setHeader('Content-Length', cachedThumbnail.buffer.length);
      
      // Send the thumbnail
      res.send(cachedThumbnail.buffer);
    } catch (error) {
      next(error);
    }
  };

  // Get title
  getTitle = async (req, res, next) => {
    try {
      const { url } = req.body;
      
      console.log(`Getting title for: ${url}`);
      
      const title = await this.ytdlp.getTitleAsync(url);
      
      res.json({
        success: true,
        data: { title }
      });
    } catch (error) {
      next(error);
    }
  };

  // Get file without saving
  getFile = async (req, res, next) => {
    try {
      const { 
        url, 
        format = { filter: 'audioandvideo', quality: 'highest', type: 'mp4' },
        filename 
      } = req.body;

      console.log(`Getting file for: ${url}`);

      const file = await this.ytdlp.getFileAsync(url, {
        format: format,
        filename: filename,
        onProgress: (progress) => {
          console.log(`File progress: ${progress.percent}%`);
        }
      });

      // Set appropriate headers for file download
      res.setHeader('Content-Type', file.type || 'video/mp4');
      res.setHeader('Content-Length', file.size);
      res.setHeader('Content-Disposition', `attachment; filename="${file.name}"`);

      // Send the file buffer
      res.send(Buffer.from(await file.arrayBuffer()));
    } catch (error) {
      next(error);
    }
  };

  // Check installation
  checkInstallation = async (req, res, next) => {
    try {
      // Kiểm tra ytdlp trước
      const ytdlpInstalled = await this.ytdlp.checkInstallationAsync({ ffmpeg: false });
      
      let ffmpegInstalled = false;
      try {
        ffmpegInstalled = await this.ytdlp.checkInstallationAsync({ ffmpeg: true });
      } catch (error) {
        // FFmpeg không bắt buộc cho tính năng cơ bản
        console.log('FFmpeg check failed:', error.message);
      }
      
      res.json({
        success: true,
        data: {
          ytdlp: ytdlpInstalled,
          ffmpeg: ffmpegInstalled,
          status: ytdlpInstalled ? 'YT-DLP ready' + (ffmpegInstalled ? ', FFmpeg ready' : ', FFmpeg not installed') : 'YT-DLP not ready'
        }
      });
    } catch (error) {
      next(error);
    }
  };

  // List downloaded files
  listDownloads = async (req, res, next) => {
    try {
      const downloadsDir = path.resolve('./downloads');
      
      if (!fs.existsSync(downloadsDir)) {
        return res.json({
          success: true,
          data: {
            files: [],
            totalFiles: 0,
            message: 'Downloads folder does not exist'
          }
        });
      }

      const files = fs.readdirSync(downloadsDir);
      const baseUrl = this.getBaseUrl(req);
      const fileDetails = files.map(file => {
        const filePath = path.join(downloadsDir, file);
        const stats = fs.statSync(filePath);
        return {
          name: file,
          path: filePath,
          size: {
            bytes: stats.size,
            readable: this.formatFileSize(stats.size)
          },
          created: stats.birthtime,
          modified: stats.mtime,
          browserUrl: `${baseUrl}/downloads/${encodeURIComponent(file)}`
        };
      });

      res.json({
        success: true,
        data: {
          files: fileDetails,
          totalFiles: files.length,
          totalSize: {
            bytes: fileDetails.reduce((sum, file) => sum + file.size.bytes, 0),
            readable: this.formatFileSize(fileDetails.reduce((sum, file) => sum + file.size.bytes, 0))
          }
        }
      });
    } catch (error) {
      next(error);
    }
  };
}
