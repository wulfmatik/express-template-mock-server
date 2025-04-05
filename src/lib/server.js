/**
 * @module server
 * @description Main module for the mock server implementation
 */
const express = require('express');
const chokidar = require('chokidar');
const fs = require('fs').promises;
require('dotenv').config();

const {
  validateConfig,
  processTemplate,
  processJsonTemplate,
  checkConditions
} = require('./server-utils');

// Fix for MaxListenersExceededWarning
process.setMaxListeners(50);

/**
 * Creates a state object to manage server state
 * @returns {Object} State object with initial values
 */
const createState = () => ({
  isShuttingDown: false,
  shutdownTimeout: null,
  server: null,
  config: null,
  watcher: null
});

/**
 * Logs a message to the console
 * @param {string} message - The message to log
 * @param {boolean} [debug=false] - Whether this is a debug message
 */
const log = (message, debug = false) => {
  // Only show debug logs in development or test mode, or if DEBUG env var is set
  const isDebugEnabled = process.env.NODE_ENV !== 'production' || process.env.DEBUG;
  if (!debug || isDebugEnabled) {
    console.log(message);
  }
};

/**
 * Loads and parses the configuration file
 * @param {string} configPath - Path to the configuration file
 * @returns {Promise<Object>} The parsed configuration
 * @throws {Error} If the configuration file is invalid or not found
 */
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

/**
 * Sets up middleware for the Express application
 * @param {Object} app - Express application
 * @param {Object} state - Server state
 * @param {Object} config - Server configuration
 */
const setupMiddleware = (app, state, config) => {
  // Add middleware for response time tracking
  app.use((req, res, next) => {
    // Ensure startTime is properly set as a number
    req.startTime = Date.now();
    
    // Store startTime on res.locals so it's available in templates
    res.locals.startTime = req.startTime;
    
    // Add a helper to calculate responseTime at any point
    req.getResponseTime = () => Date.now() - req.startTime;
    
    log(`[${new Date().toISOString()}] Setting startTime: ${req.startTime}`, true);
    
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
          const headerData = { 
            startTime: req.startTime,
            responseTime: Date.now() - req.startTime 
          };
          
          log(`Processing global header ${header} with data:`, JSON.stringify(headerData), true);
          
          res.set(header, processTemplate(value, headerData));
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
  app.use((err, req, res, _next) => {
    log(`Server error: ${err.message}`);
    res.status(500).json({ error: 'Internal server error' });
  });
};

/**
 * Sets up routes from the configuration
 * @param {Object} app - Express application
 * @param {Object} config - Server configuration
 */
const setupRoutes = (app, config) => {
  // Setup routes from config
  log('Setting up routes:', config.routes.length, true);
  
  for (const route of config.routes) {
    log(`Registering route: ${route.method.toUpperCase()} ${route.path}`, true);
    
    app[route.method.toLowerCase()](route.path, async (req, res) => {
      try {
        log(`Processing request to ${route.path}`, true);
        log(`Request startTime: ${req.startTime}`, true);
        
        // Check conditions
        if (route.conditions && !checkConditions(route.conditions, req)) {
          if (route.fallback) {
            log(`Condition not met, using fallback for ${route.path}`, true);
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
              // Make sure startTime is included in the template data
              const headerTemplateData = {
                ...req.params,
                ...req.query,
                ...req.body,
                startTime: req.startTime,
                responseTime: Date.now() - req.startTime
              };
              
              log(`Processing header ${header} with data:`, JSON.stringify(headerTemplateData), true);
              
              res.set(header, processTemplate(value, headerTemplateData));
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

        // Process response template with all necessary data
        const templateData = {
          ...req.params,
          ...req.query,
          ...req.body,
          startTime: req.startTime,
          responseTime: Date.now() - req.startTime
        };
        
        log(`Processing response for ${route.path} with data:`, JSON.stringify(templateData), true);

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

/**
 * Initiates a graceful server shutdown
 * @param {Object} state - Server state
 */
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

/**
 * Starts the server with the provided configuration
 * @param {Object} app - Express application
 * @param {Object} state - Server state
 * @param {string} configPath - Path to the configuration file
 * @param {number} [port=3000] - Port to listen on
 * @returns {Promise<void>} Resolves when the server has started
 * @throws {Error} If the server fails to start
 */
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

/**
 * Stops the server and releases all resources
 * @param {Object} state - Server state
 * @returns {Promise<void>} Resolves when the server has stopped
 */
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

/**
 * Creates a new mock server instance
 * @param {string} configPath - Path to the configuration file
 * @returns {Object} Server instance with start and stop methods
 */
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