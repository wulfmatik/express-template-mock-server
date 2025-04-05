/**
 * @module server-utils
 * @description Utility functions for the mock server
 */
const Handlebars = require('handlebars');
const { v4: uuidv4 } = require('uuid');

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
Handlebars.registerHelper('responseTime', function(options) {
  const data = options && options.data;
  const root = data && data.root;
  const startTime = root && root.startTime;
  
  if (typeof startTime === 'number') {
    return Date.now() - startTime;
  }
  
  return 0;
});

/**
 * Validates the server configuration
 * @param {Object} config - The configuration object to validate
 * @param {Array} config.routes - Array of route configurations
 * @throws {Error} If the configuration is invalid
 */
const validateConfig = (config) => {
  if (!config || !Array.isArray(config.routes)) {
    throw new Error('Config must have a "routes" array');
  }

  for (const route of config.routes) {
    if (!route.method || !route.path) {
      throw new Error('Each route must have a method and path');
    }

    if (!route.response && !route.errorCode) {
      throw new Error('Each route must have either a response or errorCode');
    }

    if (route.conditions) {
      validateConditions(route.conditions);
    }
  }
};

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

    // Ensure data is an object
    const safeData = data || {};
    
    // Debug info for startTime
    if (typeof safeData.startTime !== 'number') {
      console.log(`Warning: startTime is ${safeData.startTime} in template data`);
      // Add a fallback startTime
      safeData.startTime = Date.now();
    }

    const compiledTemplate = Handlebars.compile(template);
    const result = compiledTemplate(safeData);

    if (result === undefined || result === '') {
      console.log(`Empty result for template: ${template} with data:`, JSON.stringify(safeData));
      throw new Error('Template produced empty result');
    }

    return result;
  } catch (error) {
    console.log(`Template processing error: ${error.message} for template: ${template}`);
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
          console.log(`Error processing key ${key}:`, error.message);
          throw error;
        }
      }
      return result;
    }

    return json;
  } catch (error) {
    console.log(`JSON template processing error: ${error.message}`);
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