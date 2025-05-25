
const { app, BrowserWindow, Menu, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const express = require('express');
const WebSocket = require('ws');

class SoblendBrowser {
  constructor() {
    this.windows = [];
    this.extensions = [];
    this.server = null;
    this.wss = null;
    this.init();
  }

  init() {
    app.whenReady().then(() => {
      this.createMainWindow();
      this.setupMenu();
      this.startInternalServer();
      this.loadExtensions();
    });

    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        this.createMainWindow();
      }
    });

    this.setupIPC();
  }

  createMainWindow() {
    const mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        webSecurity: false,
        allowRunningInsecureContent: true
      },
      icon: path.join(__dirname, '../assets/icon.png'),
      titleBarStyle: 'hidden',
      titleBarOverlay: {
        color: '#2f3241',
        symbolColor: '#74b1be'
      }
    });

    mainWindow.loadFile('src/renderer/index.html');
    this.windows.push(mainWindow);

    mainWindow.on('closed', () => {
      const index = this.windows.indexOf(mainWindow);
      if (index > -1) {
        this.windows.splice(index, 1);
      }
    });

    return mainWindow;
  }

  setupMenu() {
    const template = [
      {
        label: 'Archivo',
        submenu: [
          {
            label: 'Nueva Ventana',
            accelerator: 'CmdOrCtrl+N',
            click: () => this.createMainWindow()
          },
          {
            label: 'Nueva Pestaña',
            accelerator: 'CmdOrCtrl+T',
            click: () => this.createNewTab()
          },
          { type: 'separator' },
          {
            label: 'Salir',
            accelerator: 'CmdOrCtrl+Q',
            click: () => app.quit()
          }
        ]
      },
      {
        label: 'Extensiones',
        submenu: [
          {
            label: 'Administrar Extensiones',
            click: () => this.openExtensionManager()
          },
          {
            label: 'Instalar Extension',
            click: () => this.installExtension()
          }
        ]
      },
      {
        label: 'Herramientas',
        submenu: [
          {
            label: 'Herramientas de Desarrollador',
            accelerator: 'F12',
            click: () => {
              const focusedWindow = BrowserWindow.getFocusedWindow();
              if (focusedWindow) {
                focusedWindow.webContents.toggleDevTools();
              }
            }
          }
        ]
      }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  }

  startInternalServer() {
    this.server = express();
    this.server.use(express.static(path.join(__dirname, 'renderer')));
    this.server.use('/extensions', express.static(path.join(__dirname, '../extensions')));

    const httpServer = this.server.listen(0, '127.0.0.1', () => {
      console.log(`Soblend internal server running on port ${httpServer.address().port}`);
    });

    this.wss = new WebSocket.Server({ server: httpServer });
    this.wss.on('connection', (ws) => {
      ws.on('message', (message) => {
        this.handleWebSocketMessage(ws, message);
      });
    });
  }

  handleWebSocketMessage(ws, message) {
    try {
      const data = JSON.parse(message);
      if (data.type === 'extension_communication') {
        this.broadcastToExtensions(data.payload);
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
    }
  }

  loadExtensions() {
    const extensionsPath = path.join(__dirname, '../extensions');
    if (!fs.existsSync(extensionsPath)) {
      fs.mkdirSync(extensionsPath, { recursive: true });
    }

    const extensionDirs = fs.readdirSync(extensionsPath);
    extensionDirs.forEach(dir => {
      const manifestPath = path.join(extensionsPath, dir, 'manifest.json');
      if (fs.existsSync(manifestPath)) {
        try {
          const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
          this.extensions.push({
            id: dir,
            manifest,
            path: path.join(extensionsPath, dir)
          });
          console.log(`Extension loaded: ${manifest.name}`);
        } catch (error) {
          console.error(`Error loading extension ${dir}:`, error);
        }
      }
    });
  }

  setupIPC() {
    ipcMain.handle('get-extensions', () => {
      return this.extensions.map(ext => ({
        id: ext.id,
        name: ext.manifest.name,
        version: ext.manifest.version,
        description: ext.manifest.description
      }));
    });

    ipcMain.handle('execute-extension', async (event, extensionId, action) => {
      const extension = this.extensions.find(ext => ext.id === extensionId);
      if (extension) {
        return this.executeExtensionAction(extension, action);
      }
      return null;
    });

    ipcMain.handle('download-file', async (event, url, filename) => {
      return this.downloadFile(url, filename);
    });
  }

  async executeExtensionAction(extension, action) {
    try {
      const scriptPath = path.join(extension.path, extension.manifest.main || 'index.js');
      if (fs.existsSync(scriptPath)) {
        const extensionCode = fs.readFileSync(scriptPath, 'utf8');
        // Execute extension code in a safe context
        return eval(`(function() { ${extensionCode} })()`)();
      }
    } catch (error) {
      console.error('Extension execution error:', error);
      return { error: error.message };
    }
  }

  async downloadFile(url, filename) {
    try {
      const fetch = require('node-fetch');
      const response = await fetch(url);
      const buffer = await response.buffer();
      
      const downloadsPath = path.join(require('os').homedir(), 'Downloads');
      const filePath = path.join(downloadsPath, filename);
      
      fs.writeFileSync(filePath, buffer);
      return { success: true, path: filePath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  broadcastToExtensions(data) {
    this.wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  }
}

new SoblendBrowser();
