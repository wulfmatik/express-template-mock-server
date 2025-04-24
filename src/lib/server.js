/**
 * @module server
 * @description Main module for the mock server implementation
 */
const express = require('express');
const fs = require('fs').promises;
const cors = require('cors');
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
 * Sets up the CORS middleware
 * @param {Object} app - Express application
 * @param {Object} config - Server configuration
 */
const setupCorsMiddleware = (app, config) => {
  try {
    if (config.globals && config.globals.cors !== undefined) {
      // If cors is explicitly set to false, don't use cors middleware
      if (config.globals.cors === false) {
        log('CORS disabled by configuration');
        return;
      }
      
      // Apply cors middleware with options from config
      const corsOptions = typeof config.globals.cors === 'object' 
        ? config.globals.cors 
        : {}; // Default to empty object for default CORS settings
      
      log(`Setting up CORS with options: ${JSON.stringify(corsOptions)}`);
      app.use(cors(corsOptions));
      app.options('*', cors(corsOptions));
    } else {
      // Default behavior - enable CORS with default settings
      log('Setting up CORS with default settings');
      app.use(cors());
      app.options('*', cors());
    }
  } catch (error) {
    log(`Error setting up CORS middleware: ${error.message}`);
    throw new Error(`Failed to configure CORS: ${error.message}`);
  }
};

/**
 * Process a header value with template substitution
 * @param {string} header - Header name
 * @param {string} value - Header value template
 * @param {Object} data - Data for template substitution
 * @returns {string} Processed header value
 */
const processHeaderValue = (header, value, data) => {
  try {
    return processTemplate(value, data);
  } catch (error) {
    log(`Error processing header ${header}: ${error.message}`);
    throw new Error(`Header processing failed for ${header}: ${error.message}`);
  }
};

/**
 * Sets up response time tracking middleware
 * @param {Object} app - Express application
 */
const setupResponseTimeMiddleware = (app) => {
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
};

/**
 * Sets up shutdown handling middleware
 * @param {Object} app - Express application
 * @param {Object} state - Server state
 */
const setupShutdownMiddleware = (app, state) => {
  app.use((req, res, next) => {
    if (state.isShuttingDown) {
      res.status(503).json({ error: 'Server is shutting down' });
      return;
    }
    next();
  });
};

/**
 * Sets up global headers middleware
 * @param {Object} app - Express application
 * @param {Object} config - Server configuration
 */
const setupGlobalHeadersMiddleware = (app, config) => {
  if (config.globals && config.globals.headers) {
    app.use((req, res, next) => {
      const headerErrors = [];
      
      for (const [header, value] of Object.entries(config.globals.headers)) {
        try {
          const headerData = { 
            startTime: req.startTime,
            responseTime: Date.now() - req.startTime 
          };
          
          log(`Processing global header ${header} with data:`, JSON.stringify(headerData), true);
          
          res.set(header, processHeaderValue(header, value, headerData));
        } catch (error) {
          log(`Error processing global header ${header}: ${error.message}`);
          headerErrors.push(error.message);
          // Continue processing other headers
        }
      }
      
      // If there were errors, add a warning header but don't fail the request
      if (headerErrors.length > 0) {
        res.set('X-Header-Warning', `Failed to process ${headerErrors.length} headers`);
      }
      
      next();
    });
  }
};

/**
 * Sets up security headers middleware
 * @param {Object} app - Express application
 */
const setupSecurityHeadersMiddleware = (app) => {
  app.use((req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('X-Frame-Options', 'DENY');
    res.set('X-Powered-By', 'Express Template Mock Server');
    next();
  });
};

/**
 * Sets up error handling middleware
 * @param {Object} app - Express application
 */
const setupErrorHandlingMiddleware = (app) => {
  // Handle unhandled promise rejections
  process.on('unhandledRejection', (error) => {
    log(`Unhandled promise rejection: ${error.message}`);
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    log(`Uncaught exception: ${error.message}`);
    process.exit(1);
  });

  // Error handling middleware
  app.use((err, req, res, _next) => {
    log(`Error processing request: ${err.message}`);
    
    // Handle different types of errors
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    
    if (err.name === 'TemplateError') {
      return res.status(500).json({ error: 'Template processing error' });
    }
    
    // Default error response
    res.status(500).json({ error: 'Internal server error' });
  });
};

/**
 * Sets up middleware for the Express application
 * @param {Object} app - Express application
 * @param {Object} state - Server state
 * @param {Object} config - Server configuration
 */
const setupMiddleware = (app, state, config) => {
  setupCorsMiddleware(app, config);
  setupResponseTimeMiddleware(app);
  setupShutdownMiddleware(app, state);
  setupGlobalHeadersMiddleware(app, config);
  setupSecurityHeadersMiddleware(app);
  setupErrorHandlingMiddleware(app);
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
          const headerErrors = [];
          
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
              
              res.set(header, processHeaderValue(header, value, headerTemplateData));
            } catch (error) {
              log(`Error processing header ${header}: ${error.message}`);
              headerErrors.push(error.message);
              // Continue processing other headers
            }
          }
          
          // If there were errors, add a warning header but don't fail the request
          if (headerErrors.length > 0) {
            res.set('X-Header-Warning', `Failed to process ${headerErrors.length} headers`);
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
  if (state.isShuttingDown) {
    return;
  }

  state.isShuttingDown = true;
  log('Shutting down gracefully...');

  // Clear any existing shutdown timeout
  if (state.shutdownTimeout) {
    clearTimeout(state.shutdownTimeout);
  }

  // Set a timeout to force shutdown
  state.shutdownTimeout = setTimeout(() => {
    log('Forcing shutdown after timeout');
    process.exit(1);
  }, 5000);

  // Close the server
  if (state.server) {
    state.server.close(() => {
      log('Server closed');
      if (state.watcher) {
        state.watcher.close().then(() => {
          log('File watcher closed');
          process.exit(0);
        }).catch(err => {
          log(`Error closing watcher: ${err.message}`);
          process.exit(1);
        });
      } else {
        process.exit(0);
      }
    });
  } else {
    process.exit(0);
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
    // Load and validate config
    const config = await loadConfig(configPath);
    state.config = config;

    // Setup middleware
    setupMiddleware(app, state, config);

    // Setup routes
    setupRoutes(app, config);

    // Start server
    return new Promise((resolve, reject) => {
      let serverInstance;
      try {
        serverInstance = app.listen(port, () => {
          log(`Server started on port ${port}`);
          state.server = serverInstance;
          resolve(serverInstance);
        });

        serverInstance.on('error', (err) => {
          log(`Server error: ${err.message}`);
          reject(err);
        });
      } catch (err) {
        log(`Failed to start server: ${err.message}`);
        reject(err);
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
  try {
    // Stop file watching if active
    if (state.watcher) {
      await state.watcher.close();
      state.watcher = null;
    }

    // Stop the server if it exists
    if (state.server) {
      await new Promise((resolve, reject) => {
        state.server.close((err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
      state.server = null;
    }

    // Clear any remaining timeouts
    if (state.shutdownTimeout) {
      clearTimeout(state.shutdownTimeout);
      state.shutdownTimeout = null;
    }

    // Clear any pending requests
    if (state.server) {
      state.server.removeAllListeners();
    }

    // Reset all state
    state.isShuttingDown = false;
    state.config = null;
    state.app = null;
  } catch (error) {
    log(`Error stopping server: ${error.message}`);
    throw error;
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

/**
 * Gets an available port for the server to listen on
 * @returns {Promise<number>} Available port number
 */
const getAvailablePort = () => {
  return new Promise((resolve) => {
    const server = require('net').createServer();
    server.listen(0, () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
};

module.exports = {
  createMockServer,
  getAvailablePort
}; 
