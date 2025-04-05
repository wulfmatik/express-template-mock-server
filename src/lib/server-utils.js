const Handlebars = require('handlebars');
const { v4: uuidv4 } = require('uuid');

// Register custom Handlebars helpers
Handlebars.registerHelper('now', () => new Date().toISOString());
Handlebars.registerHelper('random', (min, max) => Math.floor(Math.random() * (max - min + 1)) + min);
Handlebars.registerHelper('uuid', () => uuidv4());
Handlebars.registerHelper('responseTime', function() {
  return Date.now() - this.startTime;
});

// Config validation functions
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

const validateConditions = (conditions) => {
  const validFields = ['query', 'headers', 'body'];
  const invalidFields = Object.keys(conditions).filter(field => !validFields.includes(field));

  if (invalidFields.length > 0) {
    throw new Error(`Invalid condition fields: ${invalidFields.join(', ')}`);
  }
};

// Template processing functions
const processTemplate = (template, data) => {
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
};

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
          throw new Error('Template processing error');
        }
      }
      return result;
    }

    return json;
  } catch (error) {
    throw new Error('Template processing error');
  }
};

// Condition checking functions
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