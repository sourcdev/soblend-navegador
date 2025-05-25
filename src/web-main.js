
const express = require('express');
const path = require('path');
const fs = require('fs');
const WebSocket = require('ws');

class SoblendWebBrowser {
  constructor() {
    this.app = express();
    this.server = null;
    this.wss = null;
    this.extensions = [];
    this.port = process.env.PORT || 5000;
    this.init();
  }

  init() {
    this.setupExpress();
    this.loadExtensions();
    this.startServer();
    this.setupWebSocket();
  }

  setupExpress() {
    this.app.use(express.static(path.join(__dirname, 'renderer')));
    this.app.use('/assets', express.static(path.join(__dirname, '../assets')));
    this.app.use('/extensions', express.static(path.join(__dirname, '../extensions')));
    this.app.use(express.json());

    // Main route
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, 'renderer', 'index.html'));
    });

    // API routes
    this.app.get('/api/extensions', (req, res) => {
      res.json(this.extensions.map(ext => ({
        id: ext.id,
        name: ext.manifest.name,
        version: ext.manifest.version,
        description: ext.manifest.description
      })));
    });

    this.app.post('/api/download', async (req, res) => {
      const { url, filename } = req.body;
      try {
        const result = await this.downloadFile(url, filename);
        res.json(result);
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });
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

  async downloadFile(url, filename) {
    try {
      const fetch = require('node-fetch');
      const response = await fetch(url);
      const buffer = await response.buffer();
      
      const downloadsPath = path.join(__dirname, '../downloads');
      if (!fs.existsSync(downloadsPath)) {
        fs.mkdirSync(downloadsPath, { recursive: true });
      }
      
      const filePath = path.join(downloadsPath, filename);
      fs.writeFileSync(filePath, buffer);
      return { success: true, path: filePath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  startServer() {
    this.server = this.app.listen(this.port, '0.0.0.0', () => {
      console.log(`🚀 Soblend Web Browser running on http://0.0.0.0:${this.port}`);
      console.log(`📱 Access your browser at: https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`);
    });
  }

  setupWebSocket() {
    this.wss = new WebSocket.Server({ server: this.server });
    this.wss.on('connection', (ws) => {
      console.log('WebSocket client connected');
      
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message);
          this.handleWebSocketMessage(ws, data);
        } catch (error) {
          console.error('WebSocket message error:', error);
        }
      });

      ws.on('close', () => {
        console.log('WebSocket client disconnected');
      });
    });
  }

  handleWebSocketMessage(ws, data) {
    if (data.type === 'extension_communication') {
      this.broadcastToExtensions(data.payload);
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

new SoblendWebBrowser();
