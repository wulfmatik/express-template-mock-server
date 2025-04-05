const express = require('express');
const chokidar = require('chokidar');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

const {
  validateConfig,
  processTemplate,
  processJsonTemplate,
  checkConditions
} = require('./server-utils');

// Fix for MaxListenersExceededWarning
process.setMaxListeners(50);

// Shared state (minimal, only what's necessary)
const createState = () => ({
  isShuttingDown: false,
  shutdownTimeout: null,
  server: null,
  config: null,
  watcher: null
});

// Utility functions
const log = (message) => {
  console.log(message);
};

// Config handling functions
const loadConfig = async (configPath) => {
  try {
    const configContent = await fs.readFile(configPath, 'utf8');
    try {
      const config = JSON.parse(configContent);
      validateConfig(config);
      log('Config loaded successfully');
      return config;
    } catch (error) {
      throw new Error('Invalid JSON in config file');
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Config file not found: ${configPath}`);
    }
    throw error;
  }
};

// Server setup functions
const setupMiddleware = (app, state, config) => {
  // Add middleware for response time tracking
  app.use((req, res, next) => {
    req.startTime = Date.now();
    next();
  });

  // Add middleware for shutdown handling
  app.use((req, res, next) => {
    if (state.isShuttingDown) {
      res.status(503).json({ error: 'Server is shutting down' });
      return;
    }
    next();
  });

  // Add global headers
  if (config.globals && config.globals.headers) {
    app.use((req, res, next) => {
      for (const [header, value] of Object.entries(config.globals.headers)) {
        try {
          res.set(header, processTemplate(value, { 
            startTime: req.startTime,
            responseTime: Date.now() - req.startTime 
          }));
        } catch (error) {
          log(`Error processing global header ${header}: ${error.message}`);
        }
      }
      next();
    });
  }

  // Add security headers
  app.use((req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('X-Frame-Options', 'DENY');
    res.set('X-XSS-Protection', '1; mode=block');
    next();
  });

  // Add error handler
  app.use((err, req, res, next) => {
    log(`Server error: ${err.message}`);
    res.status(500).json({ error: 'Internal server error' });
  });
};

const setupRoutes = (app, config) => {
  // Setup routes from config
  for (const route of config.routes) {
    app[route.method.toLowerCase()](route.path, async (req, res) => {
      try {
        // Check conditions
        if (route.conditions && !checkConditions(route.conditions, req)) {
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
              res.set(header, processTemplate(value, {
                ...req.params,
                ...req.query,
                ...req.body,
                startTime: req.startTime,
                responseTime: Date.now() - req.startTime
              }));
            } catch (error) {
              log(`Error processing header ${header}: ${error.message}`);
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
          startTime: req.startTime,
          responseTime: Date.now() - req.startTime
        };

        try {
          const response = processJsonTemplate(route.response, templateData);
          res.json(response);
        } catch (error) {
          log(`Error processing response: ${error.message}`);
          res.status(500).json({ error: 'Internal server error' });
        }
      } catch (error) {
        log(`Error processing route ${route.path}: ${error.message}`);
        res.status(500).json({ error: 'Internal server error' });
      }
    });
  }

  // Add 404 handler
  app.use((req, res) => {
    res.status(404).json({ error: 'Not Found' });
  });
};

// Server lifecycle functions
const gracefulShutdown = (state) => {
  log('\nInitiating graceful shutdown...');
  state.isShuttingDown = true;

  if (state.server) {
    state.server.close(() => {
      log('Server closed');
      if (process.env.NODE_ENV === 'test') {
        process.emit('serverClosed');
      } else {
        process.exit(0);
      }
    });

    // Force shutdown after 10 seconds
    state.shutdownTimeout = setTimeout(() => {
      console.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 10000);
  }
};

const startServer = async (app, state, configPath, port = 3000) => {
  try {
    // Load configuration
    state.config = await loadConfig(configPath);
    
    // Setup server
    setupMiddleware(app, state, state.config);
    setupRoutes(app, state.config);
    
    return new Promise((resolve, reject) => {
      state.server = app.listen(port, () => {
        log(`Mock server running on port ${port}`);
        resolve();
      });

      state.server.on('error', (error) => {
        console.error('Server error:', error);
        gracefulShutdown(state);
        reject(error);
      });
      
      // Watch for config changes
      if (process.env.NODE_ENV !== 'test') {
        state.watcher = chokidar.watch(configPath);
        state.watcher.on('change', async () => {
          try {
            log('Config changed, reloading...');
            state.config = await loadConfig(configPath);
            
            // Reset routes
            app._router.stack = app._router.stack.filter(layer => !layer.route);
            setupMiddleware(app, state, state.config);
            setupRoutes(app, state.config);
            
            log('Routes reloaded successfully');
          } catch (error) {
            log(`Error reloading config: ${error.message}`);
          }
        });
      }
    });
  } catch (error) {
    log(`Failed to start server: ${error.message}`);
    throw error;
  }
};

const stopServer = async (state) => {
  if (state.server) {
    if (state.shutdownTimeout) {
      clearTimeout(state.shutdownTimeout);
      state.shutdownTimeout = null;
    }
    
    if (state.watcher) {
      await state.watcher.close();
      state.watcher = null;
    }
    
    await new Promise(resolve => state.server.close(resolve));
    state.server = null;
  }
};

// Main server factory function
const createMockServer = (configPath) => {
  const app = express();
  const state = createState();
  
  // Add body parsing middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  
  // Store handler references for cleanup
  const handleSigterm = () => gracefulShutdown(state);
  const handleSigint = () => gracefulShutdown(state);
  
  // Setup shutdown handlers
  process.on('SIGTERM', handleSigterm);
  process.on('SIGINT', handleSigint);
  
  return {
    start: (port = 3000) => startServer(app, state, configPath, port),
    stop: async () => {
      await stopServer(state);
      // Remove signal handlers when server is stopped
      process.removeListener('SIGTERM', handleSigterm);
      process.removeListener('SIGINT', handleSigint);
    }
  };
};

module.exports = createMockServer; 