# Video Downloader API

API Node.js để tải video sử dụng ytdlp-nodejs với khả năng auto-detect host cho việc deploy trên nhiều nền tảng.

## 🚀 Deploy nhanh

### Vercel
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

### Railway
[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new)

### Heroku
```bash
heroku create your-app-name
git push heroku main
```

### Docker
```bash
docker build -t video-downloader-api .
docker run -p 3000:3000 video-downloader-api
```

## Cài đặt local

1. Cài đặt dependencies:
```bash
npm install
```

2. Cài đặt FFmpeg (tùy chọn):
```bash
npm run install-ffmpeg
```

## Khởi chạy

### Development mode:
```bash
npm run dev
```

### Production mode:
```bash
npm start
```

API sẽ tự động detect host và port. Kiểm tra console log để biết URL chính xác.

## 🌐 Cấu hình Environment

Tạo file `.env` từ `.env.example`:

```bash
# Không cần cấu hình gì - tự động detect host
NODE_ENV=production

# Hoặc custom nếu cần:
# BASE_URL=https://your-domain.com
# HOST=0.0.0.0
# PORT=3000
```

## API Endpoints

### 1. Lấy thông tin video
**POST** `/api/video/info`

```json
{
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "flatPlaylist": true
}
```

### 2. Tải video
**POST** `/api/video/download`

```json
{
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "format": {
    "filter": "audioandvideo",
    "quality": "720p",
    "type": "mp4"
  },
  "output": "./downloads/%(title)s.%(ext)s"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Video downloaded successfully",
  "data": {
    "filePath": "downloads/Rick Astley - Never Gonna Give You Up.mp4",
    "fileName": "Rick Astley - Never Gonna Give You Up.mp4",
    "fullPath": "C:/path/to/downloads/Rick Astley - Never Gonna Give You Up.mp4",
    "browserUrl": "http://localhost:3000/downloads/Rick%20Astley%20-%20Never%20Gonna%20Give%20You%20Up.mp4",
    "downloadCompleted": true,
    "size": {
      "bytes": 11750943,
      "readable": "11.21 MB"
    }
  },
  "rawOutput": "..."
}
```

### 3. Stream video
**GET** `/api/video/stream?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ&format=best`

### 4. Lấy thumbnails
**POST** `/api/video/thumbnails`

```json
{
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
}
```

### 5. Lấy tiêu đề video
**POST** `/api/video/title`

```json
{
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
}
```

### 6. Lấy file video (không lưu)
**POST** `/api/video/file`

```json
{
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "format": {
    "filter": "audioandvideo",
    "quality": "highest",
    "type": "mp4"
  },
  "filename": "video.mp4"
}
```

### 7. Kiểm tra cài đặt
**GET** `/api/video/check-installation`

### 8. Danh sách file đã tải
**GET** `/api/video/downloads`

**Response:**
```json
{
  "success": true,
  "data": {
    "files": [
      {
        "name": "video.mp4",
        "path": "/full/path/to/video.mp4",
        "browserUrl": "http://localhost:3000/downloads/video.mp4",
        "size": {
          "bytes": 11750943,
          "readable": "11.21 MB"
        },
        "created": "2025-07-29T15:00:00.000Z",
        "modified": "2025-07-29T15:00:00.000Z"
      }
    ],
    "totalFiles": 1,
    "totalSize": {
      "bytes": 11750943,
      "readable": "11.21 MB"
    }
  }
}
```

### 9. Truy cập file đã tải
**GET** `/downloads/{filename}`

Truy cập trực tiếp file đã tải qua trình duyệt.

**Ví dụ:**
- `http://localhost:3000/downloads/video.mp4` - Xem/tải file video
- Hỗ trợ streaming video trực tiếp trong trình duyệt

## Format Options

### Video + Audio:
```json
{
  "filter": "audioandvideo",
  "quality": "highest|lowest|720p|1080p|etc",
  "type": "mp4|webm"
}
```

### Chỉ Video:
```json
{
  "filter": "videoonly",
  "quality": "2160p|1440p|1080p|720p|480p|360p|240p|144p|highest|lowest",
  "type": "mp4|webm"
}
```

### Chỉ Audio:
```json
{
  "filter": "audioonly",
  "quality": "highest|lowest"
}
```

## Ví dụ sử dụng

### JavaScript/Node.js:
```javascript
// Lấy thông tin video
const response = await fetch('http://localhost:3000/api/video/info', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
  })
});
const info = await response.json();

// Tải video
const downloadResponse = await fetch('http://localhost:3000/api/video/download', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    format: {
      filter: 'audioandvideo',
      quality: '720p',
      type: 'mp4'
    }
  })
});
```

### cURL:
```bash
# Lấy thông tin video
curl -X POST http://localhost:3000/api/video/info \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"}'

# Tải video
curl -X POST http://localhost:3000/api/video/download \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "format": {"filter": "audioandvideo", "quality": "720p", "type": "mp4"}}'
```

## Lỗi phổ biến

1. **Port đã được sử dụng**: Thay đổi port trong file `.env` hoặc biến môi trường `PORT`
2. **FFmpeg không tìm thấy**: Chạy `npm run install-ffmpeg` hoặc cài đặt thủ công
3. **URL không hợp lệ**: Kiểm tra URL video có đúng định dạng không

## Rate Limiting

API có giới hạn 100 requests mỗi 15 phút cho mỗi IP.

## Bảo mật

- Helmet.js để bảo mật headers
- CORS được kích hoạt
- Rate limiting
- Input validation

## License

MIT
