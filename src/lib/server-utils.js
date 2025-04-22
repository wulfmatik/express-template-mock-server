/**
 * @module server-utils
 * @description Utility functions for the mock server
 */
const Handlebars = require('handlebars');
const { v4: uuidv4 } = require('uuid');

/**
 * Logs a message to the console
 * @param {string} message - The message to log
 * @param {boolean} [debug=false] - Whether this is a debug message
 */
const log = (message, debug = false) => {
  // Only show debug logs in development or test mode, or if DEBUG env var is set
  const isDebugEnabled = process.env.NODE_ENV !== 'production' || process.env.DEBUG;
  if (!debug || isDebugEnabled) {
    // eslint-disable-next-line no-console
    console.log(message);
  }
};

// Register custom Handlebars helpers
/**
 * Handlebars helper that returns the current date and time in ISO format
 * @returns {string} Current date and time in ISO format
 */
Handlebars.registerHelper('now', function() {
  return new Date().toISOString();
});

/**
 * Handlebars helper that returns a random integer between min and max (inclusive)
 * @param {number} min - Minimum value (inclusive)
 * @param {number} max - Maximum value (inclusive)
 * @returns {number} Random integer between min and max
 */
Handlebars.registerHelper('random', function(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
});

/**
 * Handlebars helper that returns a UUID v4
 * @returns {string} UUID v4
 */
Handlebars.registerHelper('uuid', function() {
  return uuidv4();
});

/**
 * Handlebars helper that returns the response time in milliseconds
 * Using the startTime passed in the data context
 * @returns {number} Response time in milliseconds
 */
Handlebars.registerHelper('responseTime', function() {
  // Original version that's known to work
  if (this && typeof this.startTime === 'number') {
    return Date.now() - this.startTime;
  }
  
  // Safer fallback
  return 0;
});

/**
 * Validates the conditions object in a route configuration
 * @param {Object} conditions - The conditions object to validate
 * @param {Object} [conditions.query] - Query parameters conditions
 * @param {Object} [conditions.headers] - Headers conditions
 * @param {Object} [conditions.body] - Request body conditions
 * @throws {Error} If the conditions object contains invalid fields
 */
const validateConditions = (conditions) => {
  const validFields = ['query', 'headers', 'body'];
  const invalidFields = Object.keys(conditions).filter(field => !validFields.includes(field));

  if (invalidFields.length > 0) {
    throw new Error(`Invalid condition fields: ${invalidFields.join(', ')}`);
  }
};

/**
 * Validates CORS options
 * @param {Object} corsOptions - CORS configuration options
 * @throws {Error} If the CORS options contain invalid fields or values
 */
const validateCorsOptions = (corsOptions) => {
  // Valid CORS option field names
  const validFields = [
    'origin', 'methods', 'allowedHeaders', 'exposedHeaders', 
    'credentials', 'maxAge', 'preflightContinue', 'optionsSuccessStatus'
  ];
  
  // Check for invalid field names
  const corsKeys = Object.keys(corsOptions);
  const invalidFields = corsKeys.filter(key => !validFields.includes(key));
  
  if (invalidFields.length > 0) {
    throw new Error(`Invalid CORS configuration fields: ${invalidFields.join(', ')}`);
  }
  
  // Validate field values
  if (corsOptions.methods && !Array.isArray(corsOptions.methods) && typeof corsOptions.methods !== 'string') {
    throw new Error('CORS methods must be a string or an array of strings');
  }
  
  if (corsOptions.allowedHeaders && !Array.isArray(corsOptions.allowedHeaders) && typeof corsOptions.allowedHeaders !== 'string') {
    throw new Error('CORS allowedHeaders must be a string or an array of strings');
  }
  
  if (corsOptions.exposedHeaders && !Array.isArray(corsOptions.exposedHeaders) && typeof corsOptions.exposedHeaders !== 'string') {
    throw new Error('CORS exposedHeaders must be a string or an array of strings');
  }
  
  if (corsOptions.maxAge !== undefined && typeof corsOptions.maxAge !== 'number') {
    throw new Error('CORS maxAge must be a number');
  }
  
  if (corsOptions.credentials !== undefined && typeof corsOptions.credentials !== 'boolean') {
    throw new Error('CORS credentials must be a boolean');
  }
  
  if (corsOptions.optionsSuccessStatus !== undefined && 
     (typeof corsOptions.optionsSuccessStatus !== 'number' || 
      corsOptions.optionsSuccessStatus < 200 || 
      corsOptions.optionsSuccessStatus > 299)) {
    throw new Error('CORS optionsSuccessStatus must be a valid 2xx HTTP status code');
  }
};

/**
 * Validates the server configuration
 * @param {Object} config - The configuration object to validate
 * @param {Array} config.routes - Array of route configurations
 * @param {Object} [config.globals] - Global configuration options
 * @param {Object} [config.globals.headers] - Global headers
 * @param {Object|boolean} [config.globals.cors] - CORS configuration options
 * @throws {Error} If the configuration is invalid
 */
const validateConfig = (config) => {
  if (!config || !Array.isArray(config.routes)) {
    throw new Error('Config must have a "routes" array');
  }

  // Validate global CORS configuration if present
  if (config.globals && config.globals.cors && typeof config.globals.cors === 'object') {
    validateCorsOptions(config.globals.cors);
  }

  // Validate routes
  for (const route of config.routes) {
    if (!route.method || !route.path) {
      throw new Error('Each route must have a method and path');
    }

    if (route.conditions) {
      validateConditions(route.conditions);
    }

    if (route.errorCode !== undefined) {
      if (typeof route.errorCode !== 'number' || route.errorCode < 400 || route.errorCode > 599) {
        throw new Error('errorCode must be a valid HTTP error status code (400-599)');
      }
    }

    if (route.delay !== undefined && (typeof route.delay !== 'number' || route.delay < 0)) {
      throw new Error('delay must be a non-negative number');
    }
  }
};

/**
 * Processes a template string with Handlebars
 * @param {string} template - The template string to process
 * @param {Object} data - The data to use for template processing
 * @returns {string} The processed template
 * @throws {Error} If template processing fails
 */
const processTemplate = (template, data) => {
  try {
    if (typeof template !== 'string') {
      throw new Error('Template must be a string');
    }

    // Ensure data is a safe object without circular references
    let templateData = data || {};
    
    // Debug info for startTime
    if (typeof templateData.startTime !== 'number') {
      log(`Warning: startTime is ${templateData.startTime} in template data`, true);
      // Add a fallback startTime
      templateData.startTime = Date.now();
    }

    // Detect circular references (simplified check)
    try {
      JSON.stringify(templateData);
    } catch (e) {
      if (e.message.includes('circular')) {
        log('Warning: Circular reference detected in template data', true);
        // Create a safe copy without circular references
        const safeDataCopy = {};
        for (const key in templateData) {
          if (typeof templateData[key] !== 'object' || templateData[key] === null) {
            safeDataCopy[key] = templateData[key];
          }
        }
        templateData = safeDataCopy;
      }
    }

    const compiledTemplate = Handlebars.compile(template);
    const result = compiledTemplate(templateData);

    if (result === undefined || result === '') {
      log(`Empty result for template: ${template} with data: ${JSON.stringify(templateData)}`, true);
      throw new Error(`Template produced empty result for template: ${template}`);
    }

    return result;
  } catch (error) {
    log(`Template processing error: ${error.message} for template: ${template}`, true);
    throw new Error(`Template processing error: ${error.message}`);
  }
};

/**
 * Processes a JSON object or array, applying template processing to string values
 * @param {*} json - The JSON value to process
 * @param {Object} data - The data to use for template processing
 * @returns {*} The processed JSON value
 * @throws {Error} If template processing fails
 */
const processJsonTemplate = (json, data) => {
  try {
    if (typeof json === 'string') {
      return processTemplate(json, data);
    }

    if (Array.isArray(json)) {
      return json.map(item => processJsonTemplate(item, data));
    }

    if (typeof json === 'object' && json !== null) {
      const result = {};
      for (const [key, value] of Object.entries(json)) {
        try {
          result[key] = processJsonTemplate(value, data);
        } catch (error) {
          log(`Error processing key ${key}: ${error.message}`, true);
          throw error;
        }
      }
      return result;
    }

    return json;
  } catch (error) {
    log(`JSON template processing error: ${error.message}`, true);
    throw new Error(`Template processing error: ${error.message}`);
  }
};

/**
 * Checks if request matches the specified conditions
 * @param {Object} conditions - The conditions to check
 * @param {Object} req - The request object
 * @returns {boolean} True if conditions are met, false otherwise
 */
const checkConditions = (conditions, req) => {
  if (!conditions) return true;

  for (const [field, expectedValues] of Object.entries(conditions)) {
    const actualValues = req[field];
    if (!matchValues(expectedValues, actualValues)) {
      return false;
    }
  }

  return true;
};

/**
 * Checks if actual values match expected values
 * @param {Object} expected - The expected values
 * @param {Object} actual - The actual values
 * @returns {boolean} True if values match, false otherwise
 */
const matchValues = (expected, actual) => {
  if (!actual) return false;

  for (const [key, value] of Object.entries(expected)) {
    if (actual[key] !== value) {
      return false;
    }
  }

  return true;
};

module.exports = {
  validateConfig,
  validateConditions,
  processTemplate,
  processJsonTemplate,
  checkConditions,
  matchValues
}; 