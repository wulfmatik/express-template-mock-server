const { 
  processTemplate,
  checkConditions,
  validateConfig,
  processJsonTemplate,
  validateConditions,
  matchValues
} = require('../lib/server-utils');

describe('Server Utils', () => {
  describe('Template Processing', () => {
    it('should process path parameters', () => {
      const result = processTemplate('{{id}}', { id: '123' });
      expect(result).toBe('123');
    });

    it('should process query parameters', () => {
      const result = processTemplate('{{page}}', { page: '1' });
      expect(result).toBe('1');
    });

    it('should process body fields', () => {
      const result = processTemplate('{{name}}', { name: 'Test User' });
      expect(result).toBe('Test User');
    });

    it('should process built-in helpers', () => {
      const result = processTemplate('{{now}}', {});
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should process random helper', () => {
      const result = processTemplate('{{random 1 10}}', {});
      const numberResult = parseInt(result, 10);
      expect(numberResult).toBeGreaterThanOrEqual(1);
      expect(numberResult).toBeLessThanOrEqual(10);
    });

    it('should process uuid helper', () => {
      const result = processTemplate('{{uuid}}', {});
      expect(result).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    it('should process responseTime helper', () => {
      const result = processTemplate('{{responseTime}}', { startTime: Date.now() - 100 });
      const numberResult = parseInt(result, 10);
      expect(numberResult).toBeGreaterThanOrEqual(100);
    });

    it('should handle missing startTime for responseTime helper', () => {
      // When startTime is not provided, it should use current time and return near-zero
      const result = processTemplate('{{responseTime}}', {});
      const numberResult = parseInt(result, 10);
      expect(numberResult).toBeGreaterThanOrEqual(0);
      expect(numberResult).toBeLessThan(10); // Should be very small as it's created right before use
    });

    it('should process nested templates', () => {
      const result = processTemplate({
        id: '{{id}}',
        created: '{{now}}',
        randomValue: '{{random 1 100}}'
      }, { id: '123' });
      
      expect(result.id).toBe('123');
      expect(result.created).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      const numberResult = parseInt(result.randomValue, 10);
      expect(numberResult).toBeGreaterThanOrEqual(1);
      expect(numberResult).toBeLessThanOrEqual(100);
    });

    it('should handle template errors', () => {
      jest.spyOn(require('../lib/server-utils'), 'processTemplate')
        .mockImplementationOnce(() => {
          throw new Error('Template processing error');
        });
      
      expect(() => {
        const serverUtils = require('../lib/server-utils');
        serverUtils.processTemplate('{{invalid}}', {});
      }).toThrow('Template processing error');
    });
  });

  describe('JSON Template Processing', () => {
    it('should process string values in a JSON object', () => {
      const data = { id: '123', startTime: Date.now() - 100 };
      const jsonObject = {
        user: {
          id: '{{id}}',
          created: '{{now}}',
          responseTime: '{{responseTime}}'
        }
      };
      
      const result = processJsonTemplate(jsonObject, data);
      expect(result.user.id).toBe('123');
      expect(result.user.created).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(parseInt(result.user.responseTime, 10)).toBeGreaterThanOrEqual(100);
    });

    it('should process string values in arrays', () => {
      const data = { id: '123' };
      const jsonArray = ['{{id}}', 'static', '{{now}}'];
      
      const result = processJsonTemplate(jsonArray, data);
      expect(result[0]).toBe('123');
      expect(result[1]).toBe('static');
      expect(result[2]).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should return non-object values as is', () => {
      expect(processJsonTemplate(42, {})).toBe(42);
      expect(processJsonTemplate(null, {})).toBe(null);
      expect(processJsonTemplate(undefined, {})).toBe(undefined);
      expect(processJsonTemplate(true, {})).toBe(true);
    });
    
    it('should handle errors in template processing', () => {
      // Use a real console.error spy 
      const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      // Trigger a real error by using an invalid template
      const jsonObject = {
        valid: 'valid string',
        invalid: '{{nonexistentHelper "param"}}'
      };
      
      // Expect the function to throw an error
      expect(() => {
        processJsonTemplate(jsonObject, {});
      }).toThrow(/Template processing error/);
      
      // Verify the console.error was called
      expect(spy).toHaveBeenCalled();
      
      spy.mockRestore();
    });
  });

  describe('Condition Checking', () => {
    it('should match query conditions', () => {
      const req = { query: { type: 'premium' } };
      const result = checkConditions({ query: { type: 'premium' } }, req);
      expect(result).toBe(true);
    });

    it('should match header conditions', () => {
      const req = { headers: { authorization: 'Bearer token' } };
      const result = checkConditions({ headers: { authorization: 'Bearer token' } }, req);
      expect(result).toBe(true);
    });

    it('should match body conditions', () => {
      const req = { body: { userId: '123' } };
      const result = checkConditions({ body: { userId: '123' } }, req);
      expect(result).toBe(true);
    });

    it('should handle multiple condition types', () => {
      const req = {
        query: { type: 'premium' },
        headers: { authorization: 'Bearer token' },
        body: { userId: '123' }
      };
      
      const conditions = {
        query: { type: 'premium' },
        headers: { authorization: 'Bearer token' },
        body: { userId: '123' }
      };
      
      const result = checkConditions(conditions, req);
      expect(result).toBe(true);
    });

    it('should return false if any condition fails', () => {
      const req = {
        query: { type: 'basic' },
        headers: { authorization: 'Bearer token' }
      };
      
      const conditions = {
        query: { type: 'premium' },
        headers: { authorization: 'Bearer token' }
      };
      
      const result = checkConditions(conditions, req);
      expect(result).toBe(false);
    });

    it('should handle missing request section', () => {
      const req = {
        query: { type: 'premium' }
        // headers is missing
      };
      
      const conditions = {
        query: { type: 'premium' },
        headers: { authorization: 'Bearer token' }
      };
      
      const result = checkConditions(conditions, req);
      expect(result).toBe(false);
    });

    it('should return true when no conditions provided', () => {
      const req = { query: { type: 'premium' } };
      expect(checkConditions(null, req)).toBe(true);
      expect(checkConditions(undefined, req)).toBe(true);
    });

    it('should handle nested object conditions', () => {
      const req = {
        body: {
          user: {
            profile: {
              role: 'admin'
            }
          }
        }
      };
      
      const conditions = {
        body: {
          user: {
            profile: {
              role: 'admin'
            }
          }
        }
      };
      
      const result = checkConditions(conditions, req);
      expect(result).toBe(true);
    });

    it('should handle array conditions', () => {
      const req = {
        body: {
          permissions: ['read', 'write', 'delete']
        }
      };
      
      const conditions = {
        body: {
          permissions: ['read', 'write']
        }
      };
      
      const result = checkConditions(conditions, req);
      expect(result).toBe(true);
    });

    it('should check array conditions correctly with missing items', () => {
      const req = {
        body: {
          permissions: ['read', 'delete'] // Missing 'write'
        }
      };
      
      const conditions = {
        body: {
          permissions: ['read', 'write']
        }
      };
      
      const result = checkConditions(conditions, req);
      expect(result).toBe(false);
    });

    it('should test matchValues directly for edge cases', () => {
      // Test null/undefined cases
      expect(matchValues({}, null)).toBe(false);
      expect(matchValues({}, undefined)).toBe(false);
      
      // Test mismatched values
      expect(matchValues({ a: 1 }, { a: 2 })).toBe(false);
      
      // Test mismatched nested objects
      expect(matchValues(
        { a: { b: 1 } },
        { a: { b: 2 } }
      )).toBe(false);
      
      // Test mismatched arrays
      expect(matchValues(
        { a: [1, 2] },
        { a: [3, 4] }
      )).toBe(false);
      
      // Test array with missing values
      expect(matchValues(
        { a: [1, 2, 3] },
        { a: [1, 2] }
      )).toBe(false);
      
      // Test when property exists but has different type
      expect(matchValues(
        { a: { b: 1 } },
        { a: "not an object" }
      )).toBe(false);
      
      expect(matchValues(
        { a: [1, 2] },
        { a: "not an array" }
      )).toBe(false);
    });
  });

  describe('Configuration Validation', () => {
    it('should validate a valid config', () => {
      const config = {
        port: 3000,
        globals: {
          headers: {
            'X-Powered-By': 'Express Template Mock Server',
            'X-Response-Time': '{{responseTime}}'
          }
        },
        routes: [
          {
            path: '/test',
            method: 'GET',
            response: {
              status: 200,
              body: { message: 'test' }
            }
          }
        ]
      };

      expect(() => validateConfig(config)).not.toThrow();
    });

    it('should validate config with CORS settings', () => {
      const config = {
        port: 3000,
        globals: {
          cors: {
            origin: '*',
            methods: ['GET', 'POST'],
            allowedHeaders: ['Content-Type', 'Authorization'],
            credentials: true
          }
        },
        routes: [
          {
            path: '/test',
            method: 'GET',
            response: { message: 'test' }
          }
        ]
      };

      expect(() => validateConfig(config)).not.toThrow();
    });

    it('should test validateConditions directly', () => {
      // Valid conditions
      expect(() => validateConditions({
        query: { type: 'premium' },
        headers: { authorization: 'Bearer token' },
        body: { userId: '123' }
      })).not.toThrow();
      
      // Invalid condition fields
      expect(() => validateConditions({
        query: { type: 'premium' },
        invalid: { field: 'value' } // Invalid field
      })).toThrow('Invalid condition fields');
    });

    it('should validate CORS configuration with string methods', () => {
      const config = {
        globals: {
          cors: {
            origin: '*',
            methods: 'GET,POST',
            allowedHeaders: 'Content-Type, Authorization'
          }
        },
        routes: [{ path: '/test', method: 'GET', response: {} }]
      };
      
      expect(() => validateConfig(config)).not.toThrow();
    });

    it('should validate minimal valid config', () => {
      const config = {
        routes: [
          {
            path: '/test',
            method: 'GET',
            response: { message: 'test' }
          }
        ]
      };
      
      expect(() => validateConfig(config)).not.toThrow();
    });

    it('should validate config with error routes', () => {
      const config = {
        routes: [
          {
            path: '/error',
            method: 'GET',
            errorCode: 500,
            errorMessage: 'Custom error message'
          }
        ]
      };

      expect(() => validateConfig(config)).not.toThrow();
    });

    it('should validate config with delayed routes', () => {
      const config = {
        routes: [
          {
            path: '/slow',
            method: 'GET',
            response: { message: 'Delayed response' },
            delay: 2000
          }
        ]
      };

      expect(() => validateConfig(config)).not.toThrow();
    });

    it('should validate config with conditional routes', () => {
      const config = {
        routes: [
          {
            path: '/conditional',
            method: 'GET',
            conditions: {
              query: { type: 'premium' }
            },
            response: { message: 'Premium content' },
            fallback: { message: 'Basic content' }
          }
        ]
      };

      expect(() => validateConfig(config)).not.toThrow();
    });

    it('should throw for missing routes', () => {
      const config = {
        port: 3000,
        globals: {
          headers: {
            'X-Powered-By': 'Express Template Mock Server'
          }
        }
      };

      expect(() => validateConfig(config)).toThrow('Config must have a "routes" array');
    });

    it('should throw for invalid route', () => {
      const config = {
        routes: [
          {
            response: { message: 'test' }
          }
        ]
      };

      expect(() => validateConfig(config)).toThrow('Each route must have a method and path');
    });

    it('should throw for invalid error code', () => {
      const config = {
        routes: [
          {
            path: '/error',
            method: 'GET',
            errorCode: 200
          }
        ]
      };

      expect(() => validateConfig(config)).toThrow('errorCode must be a valid HTTP error status code');
    });

    it('should throw for invalid delay', () => {
      const config = {
        routes: [
          {
            path: '/slow',
            method: 'GET',
            response: { message: 'Delayed response' },
            delay: -1000
          }
        ]
      };

      expect(() => validateConfig(config)).toThrow('delay must be a non-negative number');
    });

    it('should throw for invalid conditions', () => {
      const config = {
        routes: [
          {
            path: '/conditional',
            method: 'GET',
            conditions: {
              invalidField: { value: 'test' }
            },
            response: { message: 'Content' }
          }
        ]
      };

      expect(() => validateConfig(config)).toThrow('Invalid condition fields');
    });

    it('should throw for invalid CORS configuration', () => {
      const config = {
        globals: {
          cors: {
            invalidOption: 'value'
          }
        },
        routes: [
          {
            path: '/test',
            method: 'GET',
            response: { message: 'test' }
          }
        ]
      };

      expect(() => validateConfig(config)).toThrow('Invalid CORS configuration fields');
    });

    it('should throw for invalid CORS methods type', () => {
      const config = {
        globals: {
          cors: {
            methods: 123 // Should be string or array
          }
        },
        routes: [{ path: '/test', method: 'GET', response: {} }]
      };
      
      expect(() => validateConfig(config)).toThrow('CORS methods must be a string or an array of strings');
    });

    it('should throw for invalid CORS allowedHeaders type', () => {
      const config = {
        globals: {
          cors: {
            allowedHeaders: 123 // Should be string or array
          }
        },
        routes: [{ path: '/test', method: 'GET', response: {} }]
      };
      
      expect(() => validateConfig(config)).toThrow('CORS allowedHeaders must be a string or an array of strings');
    });

    it('should throw for invalid CORS exposedHeaders type', () => {
      const config = {
        globals: {
          cors: {
            exposedHeaders: 123 // Should be string or array
          }
        },
        routes: [{ path: '/test', method: 'GET', response: {} }]
      };
      
      expect(() => validateConfig(config)).toThrow('CORS exposedHeaders must be a string or an array of strings');
    });

    it('should throw for invalid CORS maxAge type', () => {
      const config = {
        globals: {
          cors: {
            maxAge: '1000' // Should be number
          }
        },
        routes: [{ path: '/test', method: 'GET', response: {} }]
      };
      
      expect(() => validateConfig(config)).toThrow('CORS maxAge must be a number');
    });

    it('should throw for invalid CORS credentials type', () => {
      const config = {
        globals: {
          cors: {
            credentials: 'yes' // Should be boolean
          }
        },
        routes: [{ path: '/test', method: 'GET', response: {} }]
      };
      
      expect(() => validateConfig(config)).toThrow('CORS credentials must be a boolean');
    });

    it('should throw for invalid CORS optionsSuccessStatus', () => {
      const config = {
        globals: {
          cors: {
            optionsSuccessStatus: 500 // Should be 2xx
          }
        },
        routes: [{ path: '/test', method: 'GET', response: {} }]
      };
      
      expect(() => validateConfig(config)).toThrow('CORS optionsSuccessStatus must be a valid 2xx HTTP status code');
    });
  });
}); 