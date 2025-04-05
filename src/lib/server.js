const express = require('express');
const chokidar = require('chokidar');
const Handlebars = require('handlebars');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

class MockServer {
  constructor(configPath) {
    this.app = express();
    this.configPath = configPath || process.env.MOCK_CONFIG_PATH || 'mocks.json';
    this.config = null;
    this.watcher = null;
  }

  async loadConfig() {
    try {
      const configData = await fs.readFile(this.configPath, 'utf8');
      this.config = JSON.parse(configData);
    } catch (error) {
      console.error('Error loading config:', error);
      throw error;
    }
  }

  setupRoutes() {
    this.app.use(express.json());

    for (const route of this.config.routes) {
      const method = route.method.toLowerCase();
      const path = route.path;
      const response = route.response;
      const delay = route.delay || 0;
      const errorCode = route.errorCode;

      this.app[method](path, async (req, res) => {
        if (errorCode) {
          return res.status(errorCode).send();
        }

        if (delay > 0) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        let responseData = response;
        if (typeof response === 'string' && response.includes('{{')) {
          const template = Handlebars.compile(response);
          responseData = template({
            ...req.params,
            ...req.query,
            ...req.body
          });
          res.send(responseData);
        } else {
          res.json(responseData);
        }
      });
    }
  }

  async start(port) {
    await this.loadConfig();
    this.setupRoutes();

    this.watcher = chokidar.watch(this.configPath, {
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 100
      }
    }).on('change', async () => {
      console.log('Config changed, reloading...');
      await this.loadConfig();
      this.app._router.stack = [];
      this.setupRoutes();
    });

    const serverPort = port || process.env.PORT || 3000;
    return new Promise((resolve) => {
      this.app.listen(serverPort, () => {
        console.log(`Mock server running on port ${serverPort}`);
        resolve();
      });
    });
  }

  stop() {
    if (this.watcher) {
      this.watcher.close();
    }
  }
}

module.exports = MockServer; 