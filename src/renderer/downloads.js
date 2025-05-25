
class SoblendDownloadManager {
    constructor() {
        this.downloads = [];
        this.activeDownloads = new Map();
        this.init();
    }

    init() {
        this.loadDownloads();
        this.setupDownloadHandlers();
    }

    setupDownloadHandlers() {
        // Listen for download events from main process
        if (window.ipcRenderer) {
            ipcRenderer.on('download-started', (event, downloadInfo) => {
                this.addDownload(downloadInfo);
            });

            ipcRenderer.on('download-progress', (event, downloadId, progress) => {
                this.updateDownloadProgress(downloadId, progress);
            });

            ipcRenderer.on('download-completed', (event, downloadId, result) => {
                this.completeDownload(downloadId, result);
            });
        }
    }

    addDownload(downloadInfo) {
        const download = {
            id: downloadInfo.id || Date.now().toString(),
            filename: downloadInfo.filename,
            url: downloadInfo.url,
            size: downloadInfo.size || 0,
            progress: 0,
            speed: 0,
            status: 'downloading', // downloading, completed, failed, paused
            startTime: new Date(),
            path: downloadInfo.path || ''
        };

        this.downloads.unshift(download);
        this.activeDownloads.set(download.id, download);
        this.updateDownloadsList();
        this.saveDownloads();
    }

    updateDownloadProgress(downloadId, progressInfo) {
        const download = this.activeDownloads.get(downloadId);
        if (download) {
            download.progress = progressInfo.progress || 0;
            download.speed = progressInfo.speed || 0;
            download.size = progressInfo.total || download.size;
            
            this.updateDownloadsList();
        }
    }

    completeDownload(downloadId, result) {
        const download = this.activeDownloads.get(downloadId);
        if (download) {
            download.status = result.success ? 'completed' : 'failed';
            download.progress = result.success ? 100 : download.progress;
            download.path = result.path || download.path;
            download.error = result.error;
            
            this.activeDownloads.delete(downloadId);
            this.updateDownloadsList();
            this.saveDownloads();
        }
    }

    updateDownloadsList() {
        const container = document.getElementById('downloads-list');
        if (!container) return;

        if (this.downloads.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #999; padding: 40px;">No hay descargas recientes</p>';
            return;
        }

        container.innerHTML = this.downloads.map(download => this.renderDownloadItem(download)).join('');
    }

    renderDownloadItem(download) {
        const statusIcon = this.getStatusIcon(download.status);
        const progressBar = download.status === 'downloading' ? 
            `<div class="download-progress">
                <div class="download-progress-bar" style="width: ${download.progress}%"></div>
            </div>` : '';
        
        const speedInfo = download.status === 'downloading' && download.speed > 0 ?
            `<span class="download-speed">${this.formatSpeed(download.speed)}</span>` : '';
        
        const sizeInfo = download.size > 0 ? this.formatSize(download.size) : 'Tamaño desconocido';
        
        return `
            <div class="download-item" data-download-id="${download.id}">
                <div class="download-icon">${statusIcon}</div>
                <div class="download-info">
                    <div class="download-name" title="${download.filename}">${download.filename}</div>
                    <div class="download-details">
                        <span class="download-size">${sizeInfo}</span>
                        ${speedInfo}
                        <span class="download-status">${this.getStatusText(download.status)}</span>
                        ${download.status === 'downloading' ? `<span class="download-progress-text">${Math.round(download.progress)}%</span>` : ''}
                    </div>
                    ${progressBar}
                    ${download.error ? `<div class="download-error">Error: ${download.error}</div>` : ''}
                </div>
                <div class="download-actions">
                    ${this.getDownloadActions(download)}
                </div>
            </div>
        `;
    }

    getStatusIcon(status) {
        const icons = {
            downloading: '⬇️',
            completed: '✅',
            failed: '❌',
            paused: '⏸️'
        };
        return icons[status] || '📄';
    }

    getStatusText(status) {
        const statusTexts = {
            downloading: 'Descargando',
            completed: 'Completado',
            failed: 'Falló',
            paused: 'Pausado'
        };
        return statusTexts[status] || 'Desconocido';
    }

    getDownloadActions(download) {
        switch (download.status) {
            case 'downloading':
                return `
                    <button class="download-btn pause" onclick="pauseDownload('${download.id}')">⏸️</button>
                    <button class="download-btn cancel" onclick="cancelDownload('${download.id}')">❌</button>
                `;
            case 'completed':
                return `
                    <button class="download-btn open" onclick="openDownload('${download.id}')">📂</button>
                    <button class="download-btn remove" onclick="removeDownload('${download.id}')">🗑️</button>
                `;
            case 'failed':
                return `
                    <button class="download-btn retry" onclick="retryDownload('${download.id}')">🔄</button>
                    <button class="download-btn remove" onclick="removeDownload('${download.id}')">🗑️</button>
                `;
            case 'paused':
                return `
                    <button class="download-btn resume" onclick="resumeDownload('${download.id}')">▶️</button>
                    <button class="download-btn cancel" onclick="cancelDownload('${download.id}')">❌</button>
                `;
            default:
                return '';
        }
    }

    formatSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    formatSpeed(bytesPerSecond) {
        return this.formatSize(bytesPerSecond) + '/s';
    }

    loadDownloads() {
        try {
            const saved = localStorage.getItem('soblend-downloads');
            if (saved) {
                this.downloads = JSON.parse(saved);
                // Filter out active downloads (they should restart if app restarts)
                this.downloads = this.downloads.filter(d => d.status !== 'downloading');
            }
        } catch (error) {
            console.error('Error loading downloads:', error);
        }
    }

    saveDownloads() {
        try {
            // Only save completed, failed downloads
            const downloadsToSave = this.downloads.filter(d => d.status !== 'downloading');
            localStorage.setItem('soblend-downloads', JSON.stringify(downloadsToSave));
        } catch (error) {
            console.error('Error saving downloads:', error);
        }
    }

    async startDownload(url, filename) {
        try {
            const downloadInfo = {
                id: Date.now().toString(),
                url: url,
                filename: filename || this.getFilenameFromUrl(url)
            };

            // Notify main process to start download
            if (window.ipcRenderer) {
                const result = await ipcRenderer.invoke('download-file', url, downloadInfo.filename);
                if (result.success) {
                    this.addDownload({
                        ...downloadInfo,
                        status: 'completed',
                        progress: 100,
                        path: result.path
                    });
                } else {
                    this.addDownload({
                        ...downloadInfo,
                        status: 'failed',
                        error: result.error
                    });
                }
            } else {
                // Fallback for testing
                this.addDownload(downloadInfo);
                this.simulateDownload(downloadInfo.id);
            }
        } catch (error) {
            console.error('Error starting download:', error);
        }
    }

    getFilenameFromUrl(url) {
        try {
            const urlObj = new URL(url);
            const pathname = urlObj.pathname;
            const filename = pathname.split('/').pop();
            return filename || 'download';
        } catch (error) {
            return 'download';
        }
    }

    simulateDownload(downloadId) {
        // Simulate download progress for testing
        const download = this.activeDownloads.get(downloadId);
        if (!download) return;

        let progress = 0;
        const interval = setInterval(() => {
            progress += Math.random() * 10;
            if (progress >= 100) {
                progress = 100;
                clearInterval(interval);
                this.completeDownload(downloadId, { success: true, path: '/path/to/file' });
            } else {
                this.updateDownloadProgress(downloadId, {
                    progress: progress,
                    speed: Math.random() * 1000000, // Random speed in bytes/s
                    total: 10485760 // 10MB
                });
            }
        }, 500);
    }

    clearAllDownloads() {
        if (confirm('¿Estás seguro de que quieres limpiar todo el historial de descargas?')) {
            this.downloads = [];
            this.activeDownloads.clear();
            this.updateDownloadsList();
            this.saveDownloads();
        }
    }
}

// Global functions for download management
window.pauseDownload = function(downloadId) {
    console.log('Pausing download:', downloadId);
    // Implementation would pause the actual download
};

window.resumeDownload = function(downloadId) {
    console.log('Resuming download:', downloadId);
    // Implementation would resume the download
};

window.cancelDownload = function(downloadId) {
    if (confirm('¿Cancelar esta descarga?')) {
        console.log('Cancelling download:', downloadId);
        // Implementation would cancel the download
        downloadManager.completeDownload(downloadId, { success: false, error: 'Cancelado por el usuario' });
    }
};

window.retryDownload = function(downloadId) {
    console.log('Retrying download:', downloadId);
    const download = downloadManager.downloads.find(d => d.id === downloadId);
    if (download) {
        downloadManager.startDownload(download.url, download.filename);
    }
};

window.openDownload = function(downloadId) {
    const download = downloadManager.downloads.find(d => d.id === downloadId);
    if (download && download.path) {
        // Open file in system default application
        if (window.require) {
            const { shell } = window.require('electron');
            shell.openPath(download.path);
        } else {
            console.log('Opening download:', download.path);
        }
    }
};

window.removeDownload = function(downloadId) {
    if (confirm('¿Eliminar esta descarga del historial?')) {
        const index = downloadManager.downloads.findIndex(d => d.id === downloadId);
        if (index !== -1) {
            downloadManager.downloads.splice(index, 1);
            downloadManager.updateDownloadsList();
            downloadManager.saveDownloads();
        }
    }
};

// Initialize download manager
const downloadManager = new SoblendDownloadManager();

// Export for global access
window.downloadManager = downloadManager;
