const express = require('express');
const chokidar = require('chokidar');
const Handlebars = require('handlebars');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

// Register custom Handlebars helpers
Handlebars.registerHelper('now', () => new Date().toISOString());
Handlebars.registerHelper('random', (min, max) => Math.floor(Math.random() * (max - min + 1)) + min);
Handlebars.registerHelper('uuid', () => uuidv4());
Handlebars.registerHelper('responseTime', (options) => {
  const startTime = options.data.root.startTime;
  return Date.now() - startTime;
});

class MockServer {
  constructor(configPath) {
    this.app = express();
    this.configPath = configPath || process.env.MOCK_CONFIG_PATH || 'mocks.json';
    this.config = null;
    this.watcher = null;
    this.server = null;
  }

  validateConfig(config) {
    if (!config.routes || !Array.isArray(config.routes)) {
      throw new Error('Config must have a "routes" array');
    }

    for (const route of config.routes) {
      if (!route.method || !route.path) {
        throw new Error('Each route must have a "method" and "path"');
      }

      if (!['get', 'post', 'put', 'delete', 'patch'].includes(route.method.toLowerCase())) {
        throw new Error(`Invalid HTTP method: ${route.method}`);
      }

      if (route.errorCode && (route.errorCode < 400 || route.errorCode > 599)) {
        throw new Error(`Invalid error code: ${route.errorCode}. Must be between 400-599`);
      }

      if (route.delay && (!Number.isInteger(route.delay) || route.delay < 0)) {
        throw new Error(`Invalid delay: ${route.delay}. Must be a positive integer`);
      }
    }
  }

  async loadConfig() {
    try {
      const configData = await fs.readFile(this.configPath, 'utf8');
      this.config = JSON.parse(configData);
      this.validateConfig(this.config);
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Config file not found: ${this.configPath}`);
      } else if (error instanceof SyntaxError) {
        throw new Error(`Invalid JSON in config file: ${error.message}`);
      }
      throw error;
    }
  }

  processTemplate(data, context) {
    try {
      if (typeof data === 'string' && data.includes('{{')) {
        const template = Handlebars.compile(data);
        return template(context);
      } else if (typeof data === 'object' && data !== null) {
        if (Array.isArray(data)) {
          return data.map(item => this.processTemplate(item, context));
        } else {
          const result = {};
          for (const [key, value] of Object.entries(data)) {
            result[key] = this.processTemplate(value, context);
          }
          return result;
        }
      }
      return data;
    } catch (error) {
      throw new Error(`Template processing error: ${error.message}`);
    }
  }

  checkConditions(conditions, req) {
    if (!conditions) return true;

    if (conditions.query) {
      for (const [key, value] of Object.entries(conditions.query)) {
        if (req.query[key] !== value) return false;
      }
    }

    return true;
  }

  setupRoutes() {
    this.app.use(express.json());

    // Add response time tracking
    this.app.use((req, res, next) => {
      req.startTime = Date.now();
      next();
    });

    for (const route of this.config.routes) {
      const method = route.method.toLowerCase();
      const path = route.path;
      const response = route.response;
      const delay = route.delay || 0;
      const errorCode = route.errorCode;
      const conditions = route.conditions;
      const fallback = route.fallback;
      const headers = route.headers || {};

      this.app[method](path, async (req, res) => {
        try {
          if (errorCode) {
            return res.status(errorCode).json({ 
              error: route.errorMessage || `Mock error response: ${errorCode}` 
            });
          }

          if (delay > 0) {
            await new Promise(resolve => setTimeout(resolve, delay));
          }

          const context = {
            ...req.params,
            ...req.query,
            ...req.body,
            startTime: req.startTime
          };

          // Add global headers
          if (this.config.globals?.headers) {
            const globalHeaders = this.processTemplate(this.config.globals.headers, context);
            Object.entries(globalHeaders).forEach(([key, value]) => {
              res.setHeader(key, value);
            });
          }

          // Add route-specific headers
          const processedHeaders = this.processTemplate(headers, context);
          Object.entries(processedHeaders).forEach(([key, value]) => {
            res.setHeader(key, value);
          });

          let responseData;
          if (conditions && !this.checkConditions(conditions, req)) {
            responseData = this.processTemplate(fallback, context);
          } else {
            responseData = this.processTemplate(response, context);
          }

          res.json(responseData);
        } catch (error) {
          console.error(`Error handling request to ${path}:`, error);
          res.status(500).json({ error: 'Internal server error' });
        }
      });
    }

    // Add error handling middleware after routes
    this.app.use((err, req, res, next) => {
      console.error('Error processing request:', err);
      res.status(500).json({ error: 'Internal server error' });
    });
  }

  async start(port) {
    try {
      await this.loadConfig();
      this.setupRoutes();

      this.watcher = chokidar.watch(this.configPath, {
        awaitWriteFinish: {
          stabilityThreshold: 100,
          pollInterval: 100
        }
      }).on('change', async () => {
        try {
          console.log('Config changed, reloading...');
          await this.loadConfig();
          this.app._router.stack = [];
          this.setupRoutes();
        } catch (error) {
          console.error('Error reloading config:', error);
        }
      });

      const serverPort = port || process.env.PORT || 3000;
      return new Promise((resolve) => {
        this.server = this.app.listen(serverPort, () => {
          console.log(`Mock server running on port ${serverPort}`);
          resolve();
        });
      });
    } catch (error) {
      console.error('Failed to start server:', error);
      throw error;
    }
  }

  stop() {
    if (this.watcher) {
      this.watcher.close();
    }
    if (this.server) {
      this.server.close();
    }
  }
}

module.exports = MockServer; 