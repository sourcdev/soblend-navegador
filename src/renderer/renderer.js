
// Web version - no Electron IPC needed
const isElectron = typeof window !== 'undefined' && window.require;
let ipcRenderer = null;

if (isElectron) {
    try {
        ipcRenderer = window.require('electron').ipcRenderer;
    } catch (e) {
        console.log('Running in web mode');
    }
}

class SoblendRenderer {
    constructor() {
        this.tabs = [];
        this.activeTabId = 0;
        this.tabCounter = 0;
        this.searchEngines = {
            soblend: 'https://duckduckgo.com/?q=',
            google: 'https://www.google.com/search?q=',
            bing: 'https://www.bing.com/search?q=',
            duckduckgo: 'https://duckduckgo.com/?q='
        };
        this.currentSearchEngine = 'soblend';
        this.history = [];
        this.bookmarks = [];
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.createInitialTab();
        this.loadUserData();
    }

    setupEventListeners() {
        // Navigation controls
        document.getElementById('back-btn').addEventListener('click', () => this.goBack());
        document.getElementById('forward-btn').addEventListener('click', () => this.goForward());
        document.getElementById('refresh-btn').addEventListener('click', () => this.refresh());
        document.getElementById('home-btn').addEventListener('click', () => this.goHome());
        
        // Address bar
        const addressBar = document.getElementById('address-bar');
        addressBar.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.navigate(addressBar.value);
            }
        });
        
        document.getElementById('go-btn').addEventListener('click', () => {
            this.navigate(addressBar.value);
        });

        // Tab management
        document.getElementById('new-tab-btn').addEventListener('click', () => this.createNewTab());
        
        // Browser controls
        document.getElementById('extensions-btn').addEventListener('click', () => this.openExtensionManager());
        document.getElementById('downloads-btn').addEventListener('click', () => this.openDownloadsManager());
        document.getElementById('settings-btn').addEventListener('click', () => this.openSettings());
        document.getElementById('menu-btn').addEventListener('click', () => this.openMainMenu());

        // Search engines
        document.querySelectorAll('.search-engine').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.search-engine').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentSearchEngine = btn.dataset.engine;
            });
        });

        // Modal management
        document.querySelectorAll('.modal-close').forEach(closeBtn => {
            closeBtn.addEventListener('click', (e) => {
                e.target.closest('.modal').style.display = 'none';
            });
        });

        // Click outside modal to close
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                }
            });
        });
    }

    createInitialTab() {
        this.createNewTab('Nueva Pestaña', 'soblend://start');
    }

    createNewTab(title = 'Nueva Pestaña', url = 'soblend://start') {
        const tabId = this.tabCounter++;
        
        // Create tab element
        const tabsContainer = document.getElementById('tabs-container');
        const tabElement = document.createElement('div');
        tabElement.className = 'tab';
        tabElement.dataset.tabId = tabId;
        tabElement.innerHTML = `
            <span class="tab-title">${title}</span>
            <button class="tab-close">×</button>
        `;

        // Add event listeners to tab
        tabElement.addEventListener('click', (e) => {
            if (!e.target.classList.contains('tab-close')) {
                this.switchTab(tabId);
            }
        });

        tabElement.querySelector('.tab-close').addEventListener('click', (e) => {
            e.stopPropagation();
            this.closeTab(tabId);
        });

        tabsContainer.appendChild(tabElement);

        // Create tab content
        const contentArea = document.querySelector('.content-area');
        const tabContent = document.createElement('div');
        tabContent.className = 'tab-content';
        tabContent.id = `tab-content-${tabId}`;

        if (url === 'soblend://start') {
            tabContent.innerHTML = document.getElementById('tab-content-0').innerHTML;
        } else {
            tabContent.innerHTML = `<webview src="${url}" class="webview"></webview>`;
        }

        contentArea.appendChild(tabContent);

        // Store tab data
        this.tabs.push({
            id: tabId,
            title: title,
            url: url,
            element: tabElement,
            content: tabContent,
            canGoBack: false,
            canGoForward: false
        });

        this.switchTab(tabId);
        return tabId;
    }

    closeTab(tabId) {
        const tabIndex = this.tabs.findIndex(tab => tab.id === tabId);
        if (tabIndex === -1 || this.tabs.length === 1) return;

        const tab = this.tabs[tabIndex];
        tab.element.remove();
        tab.content.remove();
        this.tabs.splice(tabIndex, 1);

        // Switch to adjacent tab
        if (tabId === this.activeTabId) {
            const newActiveIndex = Math.min(tabIndex, this.tabs.length - 1);
            this.switchTab(this.tabs[newActiveIndex].id);
        }
    }

    switchTab(tabId) {
        // Update active tab
        this.tabs.forEach(tab => {
            tab.element.classList.remove('active');
            tab.content.classList.remove('active');
        });

        const activeTab = this.tabs.find(tab => tab.id === tabId);
        if (activeTab) {
            activeTab.element.classList.add('active');
            activeTab.content.classList.add('active');
            this.activeTabId = tabId;
            
            // Update address bar
            document.getElementById('address-bar').value = activeTab.url;
            
            // Update navigation buttons
            this.updateNavigationButtons(activeTab);
        }
    }

    updateNavigationButtons(tab) {
        const backBtn = document.getElementById('back-btn');
        const forwardBtn = document.getElementById('forward-btn');
        
        backBtn.disabled = !tab.canGoBack;
        forwardBtn.disabled = !tab.canGoForward;
        
        backBtn.style.opacity = tab.canGoBack ? '1' : '0.5';
        forwardBtn.style.opacity = tab.canGoForward ? '1' : '0.5';
    }

    navigate(input) {
        if (!input.trim()) return;

        let url = input.trim();
        
        // Handle special Soblend URLs
        if (url.startsWith('soblend://')) {
            this.handleSoblendUrl(url);
            return;
        }

        // Check if it's a URL or search query
        if (!this.isValidUrl(url)) {
            // It's a search query
            url = this.searchEngines[this.currentSearchEngine] + encodeURIComponent(url);
        } else if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
        }

        const activeTab = this.tabs.find(tab => tab.id === this.activeTabId);
        if (activeTab) {
            this.navigateTab(activeTab, url);
            this.addToHistory(url);
        }
    }

    navigateTab(tab, url) {
        tab.url = url;
        document.getElementById('address-bar').value = url;

        // If it's a webview, update src
        const webview = tab.content.querySelector('.webview');
        if (webview) {
            webview.src = url;
        } else {
            // Create webview for non-start pages
            tab.content.innerHTML = `<webview src="${url}" class="webview"></webview>`;
        }

        // Update tab title (will be updated when page loads)
        this.updateTabTitle(tab.id, 'Cargando...');
    }

    handleSoblendUrl(url) {
        const path = url.replace('soblend://', '');
        
        switch (path) {
            case 'start':
                this.showStartPage();
                break;
            case 'extensions':
                this.openExtensionManager();
                break;
            case 'downloads':
                this.openDownloadsManager();
                break;
            case 'settings':
                this.openSettings();
                break;
            case 'history':
                this.openHistory();
                break;
            default:
                console.log('Unknown Soblend URL:', url);
        }
    }

    showStartPage() {
        const activeTab = this.tabs.find(tab => tab.id === this.activeTabId);
        if (activeTab) {
            activeTab.url = 'soblend://start';
            activeTab.content.innerHTML = document.getElementById('tab-content-0').innerHTML;
            document.getElementById('address-bar').value = '';
            this.updateTabTitle(this.activeTabId, 'Nueva Pestaña');
        }
    }

    updateTabTitle(tabId, title) {
        const tab = this.tabs.find(tab => tab.id === tabId);
        if (tab) {
            tab.title = title;
            const titleElement = tab.element.querySelector('.tab-title');
            if (titleElement) {
                titleElement.textContent = title;
            }
        }
    }

    isValidUrl(string) {
        try {
            new URL(string.startsWith('http') ? string : 'https://' + string);
            return true;
        } catch (_) {
            return false;
        }
    }

    goBack() {
        const activeTab = this.tabs.find(tab => tab.id === this.activeTabId);
        if (activeTab && activeTab.canGoBack) {
            const webview = activeTab.content.querySelector('.webview');
            if (webview) {
                webview.goBack();
            }
        }
    }

    goForward() {
        const activeTab = this.tabs.find(tab => tab.id === this.activeTabId);
        if (activeTab && activeTab.canGoForward) {
            const webview = activeTab.content.querySelector('.webview');
            if (webview) {
                webview.goForward();
            }
        }
    }

    refresh() {
        const activeTab = this.tabs.find(tab => tab.id === this.activeTabId);
        if (activeTab) {
            if (activeTab.url === 'soblend://start') {
                this.showStartPage();
            } else {
                const webview = activeTab.content.querySelector('.webview');
                if (webview) {
                    webview.reload();
                }
            }
        }
    }

    goHome() {
        this.navigate('soblend://start');
    }

    addToHistory(url) {
        if (url && !url.startsWith('soblend://')) {
            this.history.unshift({
                url: url,
                title: document.title || url,
                timestamp: new Date().toISOString()
            });
            
            // Keep only last 1000 entries
            if (this.history.length > 1000) {
                this.history = this.history.slice(0, 1000);
            }
            
            this.saveUserData();
        }
    }

    openExtensionManager() {
        document.getElementById('extension-modal').style.display = 'block';
        this.loadInstalledExtensions();
    }

    openDownloadsManager() {
        document.getElementById('downloads-modal').style.display = 'block';
        this.loadDownloads();
    }

    openSettings() {
        this.createNewTab('Configuración', 'soblend://settings');
    }

    openHistory() {
        this.createNewTab('Historial', 'soblend://history');
    }

    openMainMenu() {
        // Implement main menu dropdown
        console.log('Opening main menu...');
    }

    async loadInstalledExtensions() {
        try {
            let extensions = [];
            if (ipcRenderer) {
                extensions = await ipcRenderer.invoke('get-extensions');
            } else {
                // Web version - fetch from API
                const response = await fetch('/api/extensions');
                extensions = await response.json();
            }
            const container = document.getElementById('installed-extensions');
            
            container.innerHTML = '';
            
            if (extensions.length === 0) {
                container.innerHTML = '<p style="text-align: center; color: #999; padding: 40px;">No hay extensiones instaladas</p>';
                return;
            }

            extensions.forEach(ext => {
                const extElement = document.createElement('div');
                extElement.className = 'extension-item';
                extElement.innerHTML = `
                    <div class="extension-icon">🧩</div>
                    <div class="extension-info">
                        <div class="extension-name">${ext.name}</div>
                        <div class="extension-description">${ext.description || 'Sin descripción'}</div>
                        <div class="extension-version">Versión: ${ext.version}</div>
                    </div>
                    <div class="extension-actions">
                        <button class="extension-btn primary" onclick="executeExtension('${ext.id}')">Ejecutar</button>
                        <button class="extension-btn danger" onclick="uninstallExtension('${ext.id}')">Desinstalar</button>
                    </div>
                `;
                container.appendChild(extElement);
            });
        } catch (error) {
            console.error('Error loading extensions:', error);
        }
    }

    loadDownloads() {
        const container = document.getElementById('downloads-list');
        // This would load actual downloads from storage
        container.innerHTML = '<p style="text-align: center; color: #999; padding: 40px;">No hay descargas recientes</p>';
    }

    loadUserData() {
        try {
            const saved = localStorage.getItem('soblend-userdata');
            if (saved) {
                const data = JSON.parse(saved);
                this.history = data.history || [];
                this.bookmarks = data.bookmarks || [];
                this.currentSearchEngine = data.searchEngine || 'soblend';
                
                // Update search engine selection
                document.querySelectorAll('.search-engine').forEach(btn => {
                    btn.classList.toggle('active', btn.dataset.engine === this.currentSearchEngine);
                });
            }
        } catch (error) {
            console.error('Error loading user data:', error);
        }
    }

    saveUserData() {
        try {
            const data = {
                history: this.history,
                bookmarks: this.bookmarks,
                searchEngine: this.currentSearchEngine
            };
            localStorage.setItem('soblend-userdata', JSON.stringify(data));
        } catch (error) {
            console.error('Error saving user data:', error);
        }
    }
}

// Global functions for extension management
window.executeExtension = async function(extensionId) {
    try {
        const result = await ipcRenderer.invoke('execute-extension', extensionId, 'run');
        console.log('Extension result:', result);
    } catch (error) {
        console.error('Error executing extension:', error);
    }
};

window.uninstallExtension = function(extensionId) {
    if (confirm('¿Estás seguro de que quieres desinstalar esta extensión?')) {
        // Implement extension uninstallation
        console.log('Uninstalling extension:', extensionId);
    }
};

// Global functions for start page
window.openExtensionStore = function() {
    soblendApp.openExtensionManager();
};

window.openSettings = function() {
    soblendApp.openSettings();
};

window.openHistory = function() {
    soblendApp.openHistory();
};

window.openDownloads = function() {
    soblendApp.openDownloadsManager();
};

// Initialize the app
const soblendApp = new SoblendRenderer();

// Export for global access
window.soblendApp = soblendApp;
