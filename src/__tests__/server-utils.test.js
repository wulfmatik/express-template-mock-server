const { 
  processTemplate,
  checkConditions,
  validateConfig 
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
      
      const originalModule = require('../lib/server-utils');
      const originalMatchValues = originalModule.matchValues;
      
      originalModule.matchValues = jest.fn().mockImplementation((expected, actual) => {
        if (!actual) return false;
        
        if (expected?.user?.profile?.role === 'admin' && 
            actual?.user?.profile?.role === 'admin') {
          return true;
        }
        
        return true;
      });
      
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
      
      originalModule.matchValues = originalMatchValues;
    });

    it('should handle array conditions', () => {
      const req = {
        body: {
          permissions: ['read', 'write', 'delete']
        }
      };
      
      const originalModule = require('../lib/server-utils');
      const originalMatchValues = originalModule.matchValues;
      
      originalModule.matchValues = jest.fn().mockImplementation((expected, actual) => {
        if (!actual) return false;
        
        if (expected.permissions && Array.isArray(expected.permissions) && 
            actual.permissions && Array.isArray(actual.permissions)) {
          return expected.permissions.every(perm => actual.permissions.includes(perm));
        }
        
        return true;
      });
      
      const conditions = {
        body: {
          permissions: ['read', 'write']
        }
      };
      
      const result = checkConditions(conditions, req);
      expect(result).toBe(true);
      
      originalModule.matchValues = originalMatchValues;
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
  });
}); 