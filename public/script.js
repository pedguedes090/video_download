// DOM Elements
const videoUrlInput = document.getElementById('videoUrl');
const downloadBtn = document.getElementById('downloadBtn');
const statusMessage = document.getElementById('statusMessage');
const progressContainer = document.getElementById('progressContainer');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const downloadResult = document.getElementById('downloadResult');
const videoThumbnail = document.getElementById('videoThumbnail');
const videoTitle = document.getElementById('videoTitle');
const videoDuration = document.getElementById('videoDuration');
const downloadLink = document.getElementById('downloadLink');

// Mobile menu elements
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const mobileMenuOverlay = document.getElementById('mobileMenuOverlay');
const mobileMenuClose = document.getElementById('mobileMenuClose');

// Theme switcher elements
const themeSwitcher = document.getElementById('themeSwitcher');
const themeMenu = document.getElementById('themeMenu');

// Video preview elements
const videoPreview = document.getElementById('videoPreview');
const previewVideo = document.getElementById('previewVideo');
const videoSource = document.getElementById('videoSource');
const togglePreview = document.getElementById('togglePreview');
const fullscreenBtn = document.getElementById('fullscreenBtn');

// State Management
let isDownloading = false;
let currentVideoData = null;

// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
    // Smooth scrolling for navigation links
    document.querySelectorAll('.nav-link, .mobile-nav-link').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);
            
            if (targetElement) {
                targetElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
            
            // Update active nav link
            document.querySelectorAll('.nav-link, .mobile-nav-link').forEach(l => l.classList.remove('active'));
            this.classList.add('active');
            
            // Close mobile menu if open
            closeMobileMenu();
        });
    });

    // Mobile menu event listeners
    mobileMenuBtn.addEventListener('click', openMobileMenu);
    mobileMenuClose.addEventListener('click', closeMobileMenu);
    mobileMenuOverlay.addEventListener('click', function(e) {
        if (e.target === mobileMenuOverlay) {
            closeMobileMenu();
        }
    });

    // Theme switcher event listeners
    initializeTheme();
    themeSwitcher.addEventListener('click', toggleThemeMenu);
    
    // Close theme menu when clicking outside
    document.addEventListener('click', function(e) {
        if (!themeSwitcher.contains(e.target) && !themeMenu.contains(e.target)) {
            closeThemeMenu();
        }
    });
    
    // Theme option selection
    document.querySelectorAll('.theme-option').forEach(option => {
        option.addEventListener('click', function() {
            const theme = this.dataset.theme;
            setTheme(theme);
            closeThemeMenu();
        });
    });
    
    // Mobile theme option selection
    document.querySelectorAll('.mobile-theme-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const theme = this.dataset.theme;
            setTheme(theme);
            closeMobileMenu();
        });
    });

    // Video preview event listeners
    if (togglePreview) {
        togglePreview.addEventListener('click', toggleVideoPreview);
    }
    
    if (fullscreenBtn) {
        fullscreenBtn.addEventListener('click', toggleFullscreen);
    }

    // Download button click handler
    downloadBtn.addEventListener('click', handleDownload);
    
    // Enter key handler for URL input
    videoUrlInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            handleDownload();
        }
    });
    
    // URL input validation
    videoUrlInput.addEventListener('input', function() {
        const url = this.value.trim();
        if (url && !isValidUrl(url)) {
            showStatus('Vui lòng nhập URL hợp lệ', 'error');
        } else {
            hideStatus();
        }
    });
});

// Main download handler
async function handleDownload() {
    const url = videoUrlInput.value.trim();
    const selectedFormat = document.querySelector('input[name="format"]:checked').value;
    
    if (!url) {
        showStatus('Vui lòng nhập URL video', 'error');
        return;
    }
    
    if (!isValidUrl(url)) {
        showStatus('URL không hợp lệ. Vui lòng kiểm tra lại', 'error');
        return;
    }
    
    setDownloadingState(true);
    
    try {
        // First, get video info
        showStatus('Đang lấy thông tin video...', 'info');
        const videoInfo = await getVideoInfo(url);
        
        if (videoInfo.error) {
            throw new Error(videoInfo.error);
        }
        
        // Display video info
        displayVideoInfo(videoInfo);
        
        // Start download
        showStatus('Đang chuẩn bị tải xuống...', 'info');
        showProgress(0);
        
        const downloadData = await downloadVideo(url, selectedFormat);
        
        if (downloadData.error) {
            throw new Error(downloadData.error);
        }
        
        // Simulate progress (since we might not get real progress from the API)
        await simulateProgress();
        
        // Show download link - use data from download response which includes thumbnail
        showDownloadResult(downloadData);
        showStatus('Tải xuống hoàn tất! File sẽ tự động bị xóa sau 5 phút.', 'success');
        
    } catch (error) {
        console.error('Download error:', error);
        showStatus(error.message || 'Có lỗi xảy ra khi tải video', 'error');
    } finally {
        setDownloadingState(false);
    }
}

// Get video information
async function getVideoInfo(url) {
    try {
        const response = await fetch('/api/video/info', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Không thể lấy thông tin video');
        }
        
        return data.data; // API trả về data trong object data
    } catch (error) {
        console.error('Error getting video info:', error);
        return { error: error.message };
    }
}

// Download video
async function downloadVideo(url, format) {
    try {
        const response = await fetch('/api/video/download', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url, format })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Không thể tải video');
        }
        
        return data;
    } catch (error) {
        console.error('Error downloading video:', error);
        return { error: error.message };
    }
}

// Display video information
function displayVideoInfo(videoInfo) {
    if (videoInfo.thumbnail || videoInfo.thumbnails) {
        const thumbnail = videoInfo.thumbnail || (videoInfo.thumbnails && videoInfo.thumbnails[0]);
        if (thumbnail) {
            videoThumbnail.src = thumbnail;
            videoThumbnail.style.display = 'block';
        }
    } else {
        videoThumbnail.style.display = 'none';
    }
    
    videoTitle.textContent = videoInfo.title || 'Video không có tiêu đề';
    
    if (videoInfo.duration) {
        videoDuration.textContent = `Thời lượng: ${formatDuration(videoInfo.duration)}`;
    } else {
        videoDuration.textContent = '';
    }
}

// Show download result
function showDownloadResult(downloadData) {
    if (downloadData.success && downloadData.data) {
        const data = downloadData.data;
        currentVideoData = data; // Store for video preview
        
        // Update thumbnail from download data - prioritize browserUrl
        if (data.thumbnailBrowserUrl) {
            videoThumbnail.src = data.thumbnailBrowserUrl;
            videoThumbnail.style.display = 'block';
            console.log('Using thumbnail browserUrl:', data.thumbnailBrowserUrl);
        } else if (data.thumbnail) {
            videoThumbnail.src = data.thumbnail;
            videoThumbnail.style.display = 'block';
            console.log('Using original thumbnail:', data.thumbnail);
        }
        
        // Update title and duration from download data
        if (data.originalTitle) {
            videoTitle.textContent = data.originalTitle;
        }
        
        if (data.duration) {
            videoDuration.textContent = `Thời lượng: ${formatDuration(data.duration)}`;
        }
        
        // Set download link
        if (data.browserUrl) {
            downloadLink.href = data.browserUrl;
            downloadLink.download = data.fileName;
            downloadLink.style.display = 'inline-flex';
            
            // Clear previous content
            downloadLink.innerHTML = '<i class="fas fa-download"></i> Tải xuống file';
            
            // Add file info
            if (data.size && data.size.readable) {
                const sizeInfo = document.createElement('span');
                sizeInfo.textContent = ` (${data.size.readable})`;
                sizeInfo.style.fontSize = '0.9em';
                sizeInfo.style.opacity = '0.8';
                sizeInfo.classList.add('size-info');
                downloadLink.appendChild(sizeInfo);
            }
            
            // Add expiration info
            if (data.expiresAt) {
                const expirationInfo = document.createElement('div');
                expirationInfo.style.fontSize = '0.8em';
                expirationInfo.style.opacity = '0.7';
                expirationInfo.style.marginTop = '0.5rem';
                expirationInfo.innerHTML = '<i class="fas fa-clock"></i> File sẽ tự động bị xóa sau 5 phút';
                
                const resultInfo = downloadResult.querySelector('.result-info');
                const existingExpiration = resultInfo.querySelector('.expiration-info');
                if (existingExpiration) {
                    existingExpiration.remove();
                }
                
                expirationInfo.classList.add('expiration-info');
                resultInfo.appendChild(expirationInfo);
                
                // Start countdown
                startExpirationCountdown(data.expiresAt, expirationInfo);
            }
            
            // Show video preview section for video files
            if (data.fileName && (data.fileName.endsWith('.mp4') || data.fileName.endsWith('.webm'))) {
                setupVideoPreview(data.browserUrl);
                videoPreview.classList.remove('hidden');
            }
            
            downloadResult.classList.remove('hidden');
        }
    }
}

// Mobile Menu Functions
function openMobileMenu() {
    mobileMenuOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeMobileMenu() {
    mobileMenuOverlay.classList.remove('active');
    document.body.style.overflow = '';
}

// Video Preview Functions
function setupVideoPreview(videoUrl) {
    videoSource.src = videoUrl;
    previewVideo.load();
    
    // Show the video by default
    previewVideo.style.display = 'block';
    togglePreview.innerHTML = '<i class="fas fa-eye-slash"></i> Ẩn preview';
}

function toggleVideoPreview() {
    const isVisible = previewVideo.style.display !== 'none';
    
    if (isVisible) {
        previewVideo.style.display = 'none';
        previewVideo.pause();
        togglePreview.innerHTML = '<i class="fas fa-eye"></i> Hiển thị preview';
    } else {
        previewVideo.style.display = 'block';
        togglePreview.innerHTML = '<i class="fas fa-eye-slash"></i> Ẩn preview';
    }
}

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        previewVideo.requestFullscreen().catch(err => {
            console.log('Error attempting to enable fullscreen:', err);
        });
    } else {
        document.exitFullscreen();
    }
}

// Handle fullscreen change
document.addEventListener('fullscreenchange', function() {
    if (document.fullscreenElement) {
        fullscreenBtn.innerHTML = '<i class="fas fa-compress"></i> Thoát toàn màn hình';
    } else {
        fullscreenBtn.innerHTML = '<i class="fas fa-expand"></i> Toàn màn hình';
    }
});

// Start expiration countdown
function startExpirationCountdown(expiresAt, element) {
    const expirationTime = new Date(expiresAt).getTime();
    
    const countdown = setInterval(() => {
        const now = new Date().getTime();
        const timeLeft = expirationTime - now;
        
        if (timeLeft <= 0) {
            element.innerHTML = '<i class="fas fa-times-circle"></i> File đã hết hạn';
            element.style.color = '#f44336';
            clearInterval(countdown);
            downloadLink.style.opacity = '0.5';
            downloadLink.style.pointerEvents = 'none';
        } else {
            const minutes = Math.floor(timeLeft / (1000 * 60));
            const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
            element.innerHTML = `<i class="fas fa-clock"></i> File sẽ hết hạn sau ${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
    }, 1000);
}

// Progress simulation
async function simulateProgress() {
    return new Promise((resolve) => {
        let progress = 0;
        const interval = setInterval(() => {
            progress += Math.random() * 15;
            if (progress >= 100) {
                progress = 100;
                clearInterval(interval);
                resolve();
            }
            updateProgress(progress);
        }, 200);
    });
}

// Update progress bar
function updateProgress(percentage) {
    const percent = Math.min(100, Math.max(0, percentage));
    progressFill.style.width = `${percent}%`;
    progressText.textContent = `${Math.round(percent)}%`;
}

// Show progress
function showProgress(percentage = 0) {
    progressContainer.classList.remove('hidden');
    updateProgress(percentage);
}

// Hide progress
function hideProgress() {
    progressContainer.classList.add('hidden');
}

// Show status message
function showStatus(message, type = 'info') {
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${type}`;
    statusMessage.classList.remove('hidden');
}

// Hide status message
function hideStatus() {
    statusMessage.classList.add('hidden');
}

// Set downloading state
function setDownloadingState(downloading) {
    isDownloading = downloading;
    downloadBtn.disabled = downloading;
    
    if (downloading) {
        downloadBtn.innerHTML = '<i class="fas fa-spinner loading"></i> Đang tải...';
        hideStatus();
        downloadResult.classList.add('hidden');
    } else {
        downloadBtn.innerHTML = '<i class="fas fa-download"></i> Tải xuống';
        hideProgress();
    }
}

// Utility Functions
function isValidUrl(string) {
    try {
        const url = new URL(string);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (_) {
        return false;
    }
}

function formatDuration(seconds) {
    if (!seconds || isNaN(seconds)) return 'Không xác định';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
}

function formatFileSize(bytes) {
    if (!bytes || isNaN(bytes)) return 'Không xác định';
    
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}

// Scroll animations
function handleScroll() {
    const scrolled = window.pageYOffset;
    const rate = scrolled * -0.5;
    
    document.body.style.transform = `translateY(${rate}px)`;
}

// Intersection Observer for animations
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Observe elements for animations
document.addEventListener('DOMContentLoaded', () => {
    const animatedElements = document.querySelectorAll('.feature-card, .api-endpoint, .stat');
    animatedElements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });
});

// Copy to clipboard function
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showStatus('Đã sao chép vào clipboard!', 'success');
        setTimeout(hideStatus, 2000);
    }).catch(() => {
        showStatus('Không thể sao chép. Vui lòng thử lại', 'error');
    });
}

// Add copy buttons to API code blocks
document.addEventListener('DOMContentLoaded', () => {
    const codeBlocks = document.querySelectorAll('.code-block');
    codeBlocks.forEach(block => {
        const copyBtn = document.createElement('button');
        copyBtn.innerHTML = '<i class="fas fa-copy"></i>';
        copyBtn.className = 'copy-btn';
        copyBtn.style.cssText = `
            position: absolute;
            top: 10px;
            right: 10px;
            background: rgba(255, 215, 0, 0.8);
            border: none;
            border-radius: 5px;
            padding: 5px 8px;
            color: #333;
            cursor: pointer;
            font-size: 12px;
        `;
        
        block.style.position = 'relative';
        block.appendChild(copyBtn);
        
        copyBtn.addEventListener('click', () => {
            const code = block.querySelector('code').textContent;
            copyToClipboard(code);
        });
    });
});

// Health check on page load
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('/health');
        const data = await response.json();
        
        if (data.status === 'OK') {
            console.log('✅ Server is running properly');
        }
    } catch (error) {
        console.error('❌ Server health check failed:', error);
        showStatus('Không thể kết nối đến server', 'error');
    }
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Escape to close mobile menu or clear
    if (e.key === 'Escape') {
        if (mobileMenuOverlay.classList.contains('active')) {
            closeMobileMenu();
        } else if (!isDownloading) {
            videoUrlInput.value = '';
            hideStatus();
            downloadResult.classList.add('hidden');
            videoPreview.classList.add('hidden');
            videoUrlInput.focus();
        }
    }
    
    // Ctrl+Enter or Cmd+Enter to download
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (!isDownloading) {
            handleDownload();
        }
    }
});

// Auto-focus URL input
document.addEventListener('DOMContentLoaded', () => {
    videoUrlInput.focus();
});

// Theme Management Functions
function initializeTheme() {
    // Get saved theme from localStorage or default
    const savedTheme = localStorage.getItem('videoDownloaderTheme') || 'default';
    setTheme(savedTheme);
}

function setTheme(theme) {
    // Remove all theme classes
    document.body.classList.remove('theme-default', 'theme-pink-milk');
    
    // Add the selected theme class
    if (theme !== 'default') {
        document.body.classList.add(`theme-${theme}`);
    }
    
    // Update active theme option
    document.querySelectorAll('.theme-option').forEach(option => {
        option.classList.remove('active');
        if (option.dataset.theme === theme) {
            option.classList.add('active');
        }
    });
    
    // Update active mobile theme button
    document.querySelectorAll('.mobile-theme-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.theme === theme) {
            btn.classList.add('active');
        }
    });
    
    // Save theme to localStorage
    localStorage.setItem('videoDownloaderTheme', theme);
    
    // Update theme button icon based on current theme
    const themeIcon = themeSwitcher.querySelector('i');
    switch(theme) {
        case 'pink-milk':
            themeIcon.className = 'fas fa-heart';
            break;
        default:
            themeIcon.className = 'fas fa-palette';
    }
    
    console.log(`🎨 Theme changed to: ${theme}`);
}

function toggleThemeMenu() {
    themeMenu.classList.toggle('show');
    themeMenu.classList.toggle('hidden');
}

function closeThemeMenu() {
    themeMenu.classList.add('hidden');
    themeMenu.classList.remove('show');
}

// Theme keyboard shortcut (Ctrl/Cmd + T)
document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 't') {
        e.preventDefault();
        toggleThemeMenu();
    }
});
