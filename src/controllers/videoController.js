import { YtDlp } from 'ytdlp-nodejs';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import https from 'https';
import http from 'http';

export class VideoController {
  constructor() {
    // Sử dụng yt-dlp từ hệ thống (đã cài qua apt-get)
    this.ytdlp = new YtDlp({ binaryPath: '/usr/bin/yt-dlp' });

    this.fileCleanupTimers = new Map(); // Track cleanup timers
    this.thumbnailCache = new Map(); // Cache thumbnails with video ID
  }

  getBaseUrl(req) {
    const protocol = req.protocol || 'http';
    const host = req.get('host') || `localhost:${process.env.PORT || 3000}`;
    return `${protocol}://${host}`;
  }

  generateRandomFileName(originalExtension = 'mp4') {
    return `${randomUUID()}.${originalExtension}`;
  }

  generateVideoId() {
    return randomUUID();
  }

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
          
          this.thumbnailCache.set(videoId, {
            buffer: buffer,
            contentType: response.headers['content-type'] || 'image/jpeg',
            timestamp: Date.now()
          });
          
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
    }, 5 * 60 * 1000);

    this.fileCleanupTimers.set(fileName, timerId);
    console.log(`⏰ Scheduled deletion for file: ${fileName} in 5 minutes`);
  }

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
    } catch {
      return null;
    }
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

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

  downloadVideo = async (req, res, next) => {
    try {
      const { url, format = 'best', quality = 'highest' } = req.body;
      console.log(`Downloading video: ${url}`);

      const downloadsDir = path.resolve('./downloads');
      if (!fs.existsSync(downloadsDir)) {
        fs.mkdirSync(downloadsDir, { recursive: true });
      }

      const info = await this.ytdlp.getInfoAsync(url, { flatPlaylist: true });
      const videoId = this.generateVideoId();

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
      
      let extension = 'mp4';
      if (format === 'mp3' || (typeof format === 'object' && format.type === 'mp3')) {
        extension = 'mp3';
      } else if (format === 'webm') {
        extension = 'webm';
      }

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

      if (format === 'mp3') {
        downloadOptions.extractAudio = true;
        downloadOptions.audioFormat = 'mp3';
        downloadOptions.audioQuality = '192K';
      }

      const result = await this.ytdlp.downloadAsync(url, downloadOptions);

      if (!fs.existsSync(outputPath)) {
        throw new Error('Download completed but file not found');
      }

      const stats = fs.statSync(outputPath);
      this.scheduleFileDeletion(outputPath, randomFileName);

      const baseUrl = this.getBaseUrl(req);
      const browserUrl = `${baseUrl}/downloads/${encodeURIComponent(randomFileName)}`;
      
      res.json({
        success: true,
        message: 'Video downloaded successfully',
        data: {
          videoId,
          fileName: randomFileName,
          originalTitle: info.title || 'Unknown Title',
          filePath: outputPath,
          fullPath: path.resolve(outputPath),
          downloadCompleted: true,
          size: {
            bytes: stats.size,
            readable: this.formatFileSize(stats.size)
          },
          browserUrl,
          thumbnail: thumbnailBrowserUrl || info.thumbnail,
          thumbnailBrowserUrl,
          duration: info.duration || null,
          expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString()
        },
        rawOutput: result
      });
    } catch (error) {
      next(error);
    }
  };

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

      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Content-Disposition', 'inline');
      await stream.pipeAsync(res);
    } catch (error) {
      next(error);
    }
  };

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
      res.setHeader('Content-Type', cachedThumbnail.contentType);
      res.setHeader('Cache-Control', 'public, max-age=300');
      res.setHeader('Content-Length', cachedThumbnail.buffer.length);
      res.send(cachedThumbnail.buffer);
    } catch (error) {
      next(error);
    }
  };

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

  getFile = async (req, res, next) => {
    try {
      const { url, format = { filter: 'audioandvideo', quality: 'highest', type: 'mp4' }, filename } = req.body;
      console.log(`Getting file for: ${url}`);

      const file = await this.ytdlp.getFileAsync(url, {
        format,
        filename,
        onProgress: (progress) => {
          console.log(`File progress: ${progress.percent}%`);
        }
      });

      res.setHeader('Content-Type', file.type || 'video/mp4');
      res.setHeader('Content-Length', file.size);
      res.setHeader('Content-Disposition', `attachment; filename="${file.name}"`);
      res.send(Buffer.from(await file.arrayBuffer()));
    } catch (error) {
      next(error);
    }
  };

  checkInstallation = async (req, res, next) => {
    try {
      const ytdlpInstalled = await this.ytdlp.checkInstallationAsync({ ffmpeg: false });
      let ffmpegInstalled = false;
      try {
        ffmpegInstalled = await this.ytdlp.checkInstallationAsync({ ffmpeg: true });
      } catch (error) {
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
