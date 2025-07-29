import { YtDlp } from 'ytdlp-nodejs';

async function installFFmpeg() {
  try {
    console.log('📦 Installing FFmpeg...');
    const ytdlp = new YtDlp();
    await ytdlp.downloadFFmpeg();
    console.log('✅ FFmpeg installed successfully!');
  } catch (error) {
    console.error('❌ Failed to install FFmpeg:', error.message);
    process.exit(1);
  }
}

installFFmpeg();
