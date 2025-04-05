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
Handlebars.registerHelper('responseTime', () => {
  return Date.now() - this.startTime;
});

class MockServer {
  constructor(configPath) {
    this.configPath = configPath;
    this.app = express();
    this.isShuttingDown = false;
    this.startTime = Date.now();
    this.shutdownTimeout = null;

    // Add body parsing middleware
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // Graceful shutdown handler
    process.on('SIGTERM', () => this.gracefulShutdown());
    process.on('SIGINT', () => this.gracefulShutdown());
  }

  log(message) {
    console.log(message);
  }

  async loadConfig() {
    try {
      const configContent = await fs.readFile(this.configPath, 'utf8');
      try {
        this.config = JSON.parse(configContent);
      } catch (error) {
        throw new Error('Invalid JSON in config file');
      }

      this.validateConfig();
      this.log('Config loaded successfully');
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Config file not found: ${this.configPath}`);
      }
      throw error;
    }
  }

  validateConfig() {
    if (!this.config || !Array.isArray(this.config.routes)) {
      throw new Error('Config must have a "routes" array');
    }

    for (const route of this.config.routes) {
      if (!route.method || !route.path) {
        throw new Error('Each route must have a method and path');
      }

      if (!route.response && !route.errorCode) {
        throw new Error('Each route must have either a response or errorCode');
      }

      if (route.conditions) {
        this.validateConditions(route.conditions);
      }
    }
  }

  validateConditions(conditions) {
    const validFields = ['query', 'headers', 'body'];
    const invalidFields = Object.keys(conditions).filter(field => !validFields.includes(field));

    if (invalidFields.length > 0) {
      throw new Error(`Invalid condition fields: ${invalidFields.join(', ')}`);
    }
  }

  processTemplate(template, data) {
    try {
      if (typeof template !== 'string') {
        throw new Error('Template must be a string');
      }

      const compiledTemplate = Handlebars.compile(template);
      const result = compiledTemplate(data);

      if (result === undefined || result === '') {
        throw new Error('Template processing error');
      }

      return result;
    } catch (error) {
      throw new Error('Template processing error');
    }
  }

  processJsonTemplate(json, data) {
    try {
      if (typeof json === 'string') {
        return this.processTemplate(json, data);
      }

      if (Array.isArray(json)) {
        return json.map(item => this.processJsonTemplate(item, data));
      }

      if (typeof json === 'object' && json !== null) {
        const result = {};
        for (const [key, value] of Object.entries(json)) {
          try {
            result[key] = this.processJsonTemplate(value, data);
          } catch (error) {
            throw new Error('Template processing error');
          }
        }
        return result;
      }

      return json;
    } catch (error) {
      throw new Error('Template processing error');
    }
  }

  checkConditions(conditions, req) {
    if (!conditions) return true;

    for (const [field, expectedValues] of Object.entries(conditions)) {
      const actualValues = req[field];
      if (!this.matchValues(expectedValues, actualValues)) {
        return false;
      }
    }

    return true;
  }

  matchValues(expected, actual) {
    if (!actual) return false;

    for (const [key, value] of Object.entries(expected)) {
      if (actual[key] !== value) {
        return false;
      }
    }

    return true;
  }

  setupRoutes() {
    // Add middleware for response time tracking
    this.app.use((req, res, next) => {
      this.startTime = Date.now();
      next();
    });

    // Add middleware for shutdown handling
    this.app.use((req, res, next) => {
      if (this.isShuttingDown) {
        res.status(503).json({ error: 'Server is shutting down' });
        return;
      }
      next();
    });

    // Add global headers
    if (this.config.globals && this.config.globals.headers) {
      this.app.use((req, res, next) => {
        for (const [header, value] of Object.entries(this.config.globals.headers)) {
          try {
            res.set(header, this.processTemplate(value, { responseTime: Date.now() - this.startTime }));
          } catch (error) {
            this.log(`Error processing global header ${header}: ${error.message}`);
          }
        }
        next();
      });
    }

    // Add security headers
    this.app.use((req, res, next) => {
      res.set('X-Content-Type-Options', 'nosniff');
      res.set('X-Frame-Options', 'DENY');
      res.set('X-XSS-Protection', '1; mode=block');
      next();
    });

    // Setup routes from config
    for (const route of this.config.routes) {
      this.app[route.method.toLowerCase()](route.path, async (req, res) => {
        try {
          // Check conditions
          if (route.conditions && !this.checkConditions(route.conditions, req)) {
            if (route.fallback) {
              res.json(route.fallback);
              return;
            }
            res.status(400).json({ error: 'Conditions not met' });
            return;
          }

          // Add route-specific headers
          if (route.headers) {
            for (const [header, value] of Object.entries(route.headers)) {
              try {
                res.set(header, this.processTemplate(value, {
                  ...req.params,
                  ...req.query,
                  ...req.body,
                  responseTime: Date.now() - this.startTime
                }));
              } catch (error) {
                this.log(`Error processing header ${header}: ${error.message}`);
                res.status(500).json({ error: 'Internal server error' });
                return;
              }
            }
          }

          // Handle error responses
          if (route.errorCode) {
            res.status(route.errorCode).json({ error: route.errorMessage || 'Internal server error' });
            return;
          }

          // Handle delayed responses
          if (route.delay) {
            await new Promise(resolve => setTimeout(resolve, route.delay));
          }

          // Process response template
          const templateData = {
            ...req.params,
            ...req.query,
            ...req.body,
            responseTime: Date.now() - this.startTime
          };

          try {
            const response = this.processJsonTemplate(route.response, templateData);
            res.json(response);
          } catch (error) {
            this.log(`Error processing response: ${error.message}`);
            res.status(500).json({ error: 'Internal server error' });
          }
        } catch (error) {
          this.log(`Error processing route ${route.path}: ${error.message}`);
          res.status(500).json({ error: 'Internal server error' });
        }
      });
    }

    // Add 404 handler
    this.app.use((req, res) => {
      res.status(404).json({ error: 'Not Found' });
    });

    // Add error handler
    this.app.use((err, req, res, next) => {
      this.log(`Server error: ${err.message}`);
      res.status(500).json({ error: 'Internal server error' });
    });
  }

  gracefulShutdown() {
    this.log('\nInitiating graceful shutdown...');
    this.isShuttingDown = true;

    if (this.server) {
      this.server.close(() => {
        this.log('Server closed');
        if (process.env.NODE_ENV === 'test') {
          process.emit('serverClosed');
        } else {
          process.exit(0);
        }
      });

      // Force shutdown after 10 seconds
      this.shutdownTimeout = setTimeout(() => {
        console.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 10000);
    }
  }

  async start(port) {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(port, () => {
        this.log(`Mock server running on port ${port}`);
        resolve();
      });

      this.server.on('error', (error) => {
        console.error('Server error:', error);
        this.gracefulShutdown();
        reject(error);
      });
    });

    // Watch for config changes
    if (process.env.NODE_ENV !== 'test') {
      const watcher = chokidar.watch(this.configPath);
      watcher.on('change', async () => {
        try {
          await this.loadConfig();
          this.setupRoutes();
          this.log('Config reloaded successfully');
        } catch (error) {
          this.log(`Error reloading config: ${error.message}`);
        }
      });
    }

    // Handle shutdown signals
    process.on('SIGTERM', () => this.gracefulShutdown());
    process.on('SIGINT', () => this.gracefulShutdown());
  }

  async stop() {
    if (this.server) {
      if (this.shutdownTimeout) {
        clearTimeout(this.shutdownTimeout);
        this.shutdownTimeout = null;
      }
      await new Promise(resolve => this.server.close(resolve));
      this.server = null;
    }
  }
}

module.exports = MockServer; 