
class SoblendExtensionManager {
    constructor() {
        this.installedExtensions = new Map();
        this.extensionStore = [];
        this.init();
    }

    init() {
        this.setupExtensionTabs();
        this.loadExtensionStore();
    }

    setupExtensionTabs() {
        document.querySelectorAll('.ext-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.ext-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                const tabType = tab.dataset.tab;
                this.showExtensionTab(tabType);
            });
        });
    }

    showExtensionTab(tabType) {
        const content = document.getElementById('extensions-content');
        
        switch (tabType) {
            case 'installed':
                this.showInstalledExtensions();
                break;
            case 'store':
                this.showExtensionStore();
                break;
            case 'develop':
                this.showDevelopmentTools();
                break;
        }
    }

    showInstalledExtensions() {
        // This is handled by the main renderer
        soblendApp.loadInstalledExtensions();
    }

    showExtensionStore() {
        const content = document.getElementById('extensions-content');
        content.innerHTML = `
            <div class="extension-store">
                <div class="store-header">
                    <h3>Tienda de Extensiones Soblend</h3>
                    <div class="store-search">
                        <input type="text" placeholder="Buscar extensiones..." id="extension-search">
                    </div>
                </div>
                <div class="extension-categories">
                    <button class="category-btn active" data-category="all">Todas</button>
                    <button class="category-btn" data-category="productivity">Productividad</button>
                    <button class="category-btn" data-category="security">Seguridad</button>
                    <button class="category-btn" data-category="entertainment">Entretenimiento</button>
                    <button class="category-btn" data-category="development">Desarrollo</button>
                </div>
                <div id="store-extensions" class="store-extensions">
                    ${this.renderStoreExtensions()}
                </div>
            </div>
        `;

        this.setupStoreEventListeners();
    }

    renderStoreExtensions() {
        const featuredExtensions = [
            {
                id: 'ad-blocker',
                name: 'Soblend AdBlocker',
                description: 'Bloquea anuncios molestos y mejora tu experiencia de navegación',
                category: 'productivity',
                version: '2.1.0',
                downloads: '1.2M',
                rating: 4.8,
                icon: '🛡️',
                featured: true
            },
            {
                id: 'password-manager',
                name: 'Gestor de Contraseñas Seguro',
                description: 'Gestiona y genera contraseñas seguras automáticamente',
                category: 'security',
                version: '1.5.2',
                downloads: '850K',
                rating: 4.9,
                icon: '🔐',
                featured: true
            },
            {
                id: 'dark-mode',
                name: 'Modo Oscuro Universal',
                description: 'Aplica modo oscuro a cualquier sitio web',
                category: 'productivity',
                version: '3.0.1',
                downloads: '2.1M',
                rating: 4.7,
                icon: '🌙',
                featured: false
            },
            {
                id: 'translator',
                name: 'Traductor Instantáneo',
                description: 'Traduce texto seleccionado al instante',
                category: 'productivity',
                version: '1.8.0',
                downloads: '675K',
                rating: 4.6,
                icon: '🌍',
                featured: false
            },
            {
                id: 'screenshot',
                name: 'Captura de Pantalla Pro',
                description: 'Captura y edita screenshots de páginas web',
                category: 'productivity',
                version: '2.3.1',
                downloads: '920K',
                rating: 4.8,
                icon: '📸',
                featured: false
            },
            {
                id: 'video-downloader',
                name: 'Descargador de Videos',
                description: 'Descarga videos de sitios web populares',
                category: 'entertainment',
                version: '1.4.5',
                downloads: '1.5M',
                rating: 4.5,
                icon: '📹',
                featured: true
            }
        ];

        return featuredExtensions.map(ext => `
            <div class="store-extension-item ${ext.featured ? 'featured' : ''}" data-category="${ext.category}">
                <div class="store-extension-icon">${ext.icon}</div>
                <div class="store-extension-info">
                    <div class="store-extension-name">${ext.name}</div>
                    <div class="store-extension-description">${ext.description}</div>
                    <div class="store-extension-meta">
                        <span class="extension-rating">⭐ ${ext.rating}</span>
                        <span class="extension-downloads">📥 ${ext.downloads}</span>
                        <span class="extension-version">v${ext.version}</span>
                    </div>
                </div>
                <div class="store-extension-actions">
                    <button class="extension-btn primary" onclick="installExtension('${ext.id}')">
                        Instalar
                    </button>
                    <button class="extension-btn secondary" onclick="previewExtension('${ext.id}')">
                        Vista Previa
                    </button>
                </div>
            </div>
        `).join('');
    }

    setupStoreEventListeners() {
        // Search functionality
        const searchInput = document.getElementById('extension-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filterExtensions(e.target.value);
            });
        }

        // Category filtering
        document.querySelectorAll('.category-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.filterByCategory(btn.dataset.category);
            });
        });
    }

    filterExtensions(searchTerm) {
        const extensions = document.querySelectorAll('.store-extension-item');
        extensions.forEach(ext => {
            const name = ext.querySelector('.store-extension-name').textContent.toLowerCase();
            const description = ext.querySelector('.store-extension-description').textContent.toLowerCase();
            const matches = name.includes(searchTerm.toLowerCase()) || description.includes(searchTerm.toLowerCase());
            ext.style.display = matches ? 'flex' : 'none';
        });
    }

    filterByCategory(category) {
        const extensions = document.querySelectorAll('.store-extension-item');
        extensions.forEach(ext => {
            if (category === 'all' || ext.dataset.category === category) {
                ext.style.display = 'flex';
            } else {
                ext.style.display = 'none';
            }
        });
    }

    showDevelopmentTools() {
        const content = document.getElementById('extensions-content');
        content.innerHTML = `
            <div class="extension-development">
                <h3>Herramientas de Desarrollo de Extensiones</h3>
                <div class="dev-section">
                    <h4>Crear Nueva Extensión</h4>
                    <p>Desarrolla extensiones personalizadas para Soblend Navegador</p>
                    <button class="extension-btn primary" onclick="createNewExtension()">
                        Crear Extensión
                    </button>
                </div>
                
                <div class="dev-section">
                    <h4>Cargar Extensión Local</h4>
                    <p>Carga una extensión desde tu sistema de archivos para pruebas</p>
                    <input type="file" id="extension-file" accept=".zip,.crx" style="display: none;">
                    <button class="extension-btn secondary" onclick="loadLocalExtension()">
                        Cargar Archivo
                    </button>
                </div>

                <div class="dev-section">
                    <h4>Documentación para Desarrolladores</h4>
                    <p>Aprende cómo crear extensiones para Soblend</p>
                    <button class="extension-btn secondary" onclick="openDeveloperDocs()">
                        Ver Documentación
                    </button>
                </div>

                <div class="dev-section">
                    <h4>API de Extensiones</h4>
                    <div class="api-info">
                        <pre><code>// Ejemplo de API básica para extensiones
const SoblendAPI = {
    // Manipular pestañas
    tabs: {
        create: (url) => {},
        close: (tabId) => {},
        update: (tabId, properties) => {}
    },
    
    // Acceso a storage
    storage: {
        get: (key) => {},
        set: (key, value) => {},
        remove: (key) => {}
    },
    
    // Interceptar requests
    webRequest: {
        onBeforeRequest: (callback) => {},
        onHeadersReceived: (callback) => {}
    },
    
    // Modificar contenido de páginas
    contentScript: {
        executeScript: (tabId, script) => {},
        insertCSS: (tabId, css) => {}
    }
};</code></pre>
                    </div>
                </div>
            </div>
        `;
    }

    loadExtensionStore() {
        // Simulate loading from remote store
        console.log('Loading extension store...');
    }
}

// Global functions for extension store
window.installExtension = async function(extensionId) {
    try {
        console.log(`Installing extension: ${extensionId}`);
        
        // Show installation progress
        const button = event.target;
        const originalText = button.textContent;
        button.textContent = 'Instalando...';
        button.disabled = true;
        
        // Simulate installation process
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Create extension files
        await createExtensionFiles(extensionId);
        
        button.textContent = 'Instalado ✓';
        button.classList.remove('primary');
        button.classList.add('success');
        
        setTimeout(() => {
            button.textContent = originalText;
            button.disabled = false;
            button.classList.remove('success');
            button.classList.add('primary');
        }, 3000);
        
        // Refresh installed extensions
        soblendApp.loadInstalledExtensions();
        
    } catch (error) {
        console.error('Installation error:', error);
        alert('Error al instalar la extensión: ' + error.message);
    }
};

window.previewExtension = function(extensionId) {
    // Show extension preview modal
    console.log(`Previewing extension: ${extensionId}`);
    alert('Vista previa de extensión: ' + extensionId);
};

window.createNewExtension = function() {
    const extensionName = prompt('Nombre de la nueva extensión:');
    if (extensionName) {
        console.log(`Creating new extension: ${extensionName}`);
        // Create extension template
        createExtensionTemplate(extensionName);
    }
};

window.loadLocalExtension = function() {
    document.getElementById('extension-file').click();
    
    document.getElementById('extension-file').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            console.log(`Loading local extension: ${file.name}`);
            // Process the extension file
        }
    });
};

window.openDeveloperDocs = function() {
    soblendApp.createNewTab('Documentación de Extensiones', 'soblend://docs/extensions');
};

async function createExtensionFiles(extensionId) {
    const extensionData = getExtensionData(extensionId);
    
    // This would create the actual extension files
    console.log(`Creating extension files for: ${extensionData.name}`);
    
    // Simulate file creation
    return new Promise(resolve => {
        setTimeout(() => {
            console.log(`Extension ${extensionData.name} installed successfully`);
            resolve();
        }, 1000);
    });
}

function createExtensionTemplate(name) {
    const template = {
        manifest: {
            name: name,
            version: '1.0.0',
            description: 'Extensión personalizada para Soblend',
            permissions: ['tabs', 'storage'],
            main: 'index.js'
        },
        script: `
// ${name} Extension
console.log('${name} extension loaded');

// Extension main logic here
const extension = {
    init() {
        console.log('Initializing ${name}');
    },
    
    run() {
        console.log('Running ${name}');
        return { success: true, message: '${name} executed successfully' };
    }
};

extension.init();
`
    };
    
    console.log('Extension template created:', template);
    return template;
}

function getExtensionData(extensionId) {
    const extensionMap = {
        'ad-blocker': {
            name: 'Soblend AdBlocker',
            description: 'Bloquea anuncios molestos y mejora tu experiencia de navegación',
            version: '2.1.0'
        },
        'password-manager': {
            name: 'Gestor de Contraseñas Seguro',
            description: 'Gestiona y genera contraseñas seguras automáticamente',
            version: '1.5.2'
        },
        'dark-mode': {
            name: 'Modo Oscuro Universal',
            description: 'Aplica modo oscuro a cualquier sitio web',
            version: '3.0.1'
        }
    };
    
    return extensionMap[extensionId] || { name: 'Unknown Extension', version: '1.0.0' };
}

// Initialize extension manager
const extensionManager = new SoblendExtensionManager();
