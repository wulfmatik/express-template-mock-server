const MockServer = require('../lib/server');
const fs = require('fs').promises;
const path = require('path');
const request = require('supertest');

jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn()
  }
}));

// Mock process.exit
const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {});

describe('MockServer', () => {
  let server;
  const mockConfig = {
    globals: {
      headers: {
        'X-Powered-By': 'Easy Mock Server',
        'X-Response-Time': '{{responseTime}}'
      }
    },
    routes: [
      {
        method: 'GET',
        path: '/users',
        response: [
          { id: 1, name: 'John Doe' },
          { id: 2, name: 'Jane Smith' }
        ]
      },
      {
        method: 'GET',
        path: '/users/:id',
        response: {
          id: '{{id}}',
          name: 'User {{id}}',
          createdAt: '{{now}}'
        }
      },
      {
        method: 'POST',
        path: '/users',
        response: {
          id: '{{random 1000 9999}}',
          name: '{{name}}',
          createdAt: '{{now}}'
        },
        headers: {
          'X-Created-At': '{{now}}',
          'X-Request-ID': '{{uuid}}'
        }
      },
      {
        method: 'GET',
        path: '/error',
        errorCode: 500,
        errorMessage: 'Custom error message'
      },
      {
        method: 'GET',
        path: '/slow',
        response: { 
          message: 'This response is delayed',
          timestamp: '{{now}}'
        },
        delay: 2000
      },
      {
        method: 'GET',
        path: '/conditional',
        conditions: {
          query: {
            type: 'premium'
          }
        },
        response: {
          message: 'Premium content',
          features: ['advanced', 'premium']
        },
        fallback: {
          message: 'Basic content',
          features: ['basic']
        }
      },
      {
        method: 'GET',
        path: '/template-error',
        response: {
          value: '{{invalid}}'
        }
      }
    ]
  };

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    fs.readFile.mockResolvedValue(JSON.stringify(mockConfig));
    server = new MockServer('mocks.json');
    jest.clearAllMocks();
  });

  afterEach(async () => {
    if (server) {
      await server.stop();
    }
  });

  describe('Configuration', () => {
    it('should load and validate config', async () => {
      await server.loadConfig();
      expect(server.config).toEqual(mockConfig);
    });

    it('should throw error for invalid JSON', async () => {
      fs.readFile.mockResolvedValue('invalid json');
      await expect(server.loadConfig()).rejects.toThrow('Invalid JSON in config file');
    });

    it('should throw error for missing routes', async () => {
      fs.readFile.mockResolvedValue(JSON.stringify({}));
      await expect(server.loadConfig()).rejects.toThrow('Config must have a "routes" array');
    });
  });

  describe('Template Processing', () => {
    it('should process path parameters', async () => {
      await server.loadConfig();
      const result = server.processTemplate('{{id}}', { id: '123' });
      expect(result).toBe('123');
    });

    it('should process query parameters', async () => {
      await server.loadConfig();
      const result = server.processTemplate('{{page}}', { page: '1' });
      expect(result).toBe('1');
    });

    it('should process body fields', async () => {
      await server.loadConfig();
      const result = server.processTemplate('{{name}}', { name: 'Test User' });
      expect(result).toBe('Test User');
    });

    it('should process built-in helpers', async () => {
      await server.loadConfig();
      const result = server.processTemplate('{{now}}', {});
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should handle template errors', async () => {
      await server.loadConfig();
      expect(() => server.processTemplate('{{invalid}}', {})).toThrow('Template processing error');
    });
  });

  describe('Condition Checking', () => {
    it('should match query conditions', async () => {
      await server.loadConfig();
      const req = { query: { type: 'premium' } };
      const result = server.checkConditions({ query: { type: 'premium' } }, req);
      expect(result).toBe(true);
    });

    it('should match header conditions', async () => {
      await server.loadConfig();
      const req = { headers: { authorization: 'Bearer token' } };
      const result = server.checkConditions({ headers: { authorization: 'Bearer token' } }, req);
      expect(result).toBe(true);
    });

    it('should match body conditions', async () => {
      await server.loadConfig();
      const req = { body: { userId: '123' } };
      const result = server.checkConditions({ body: { userId: '123' } }, req);
      expect(result).toBe(true);
    });
  });

  describe('Server Features', () => {
    let app;

    beforeEach(async () => {
      await server.loadConfig();
      server.setupRoutes();
      app = server.app;
    });

    it('should handle basic GET requests', async () => {
      const response = await request(app).get('/users');
      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockConfig.routes[0].response);
    });

    it('should handle path parameters', async () => {
      const response = await request(app).get('/users/123');
      expect(response.status).toBe(200);
      expect(response.body.id).toBe('123');
      expect(response.body.name).toBe('User 123');
    });

    it('should handle POST requests with body', async () => {
      const response = await request(app)
        .post('/users')
        .send({ name: 'Test User' })
        .set('Content-Type', 'application/json');
      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Test User');
      expect(response.headers['x-created-at']).toBeDefined();
      expect(response.headers['x-request-id']).toBeDefined();
    });

    it('should handle error responses', async () => {
      const response = await request(app).get('/error');
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Custom error message');
    });

    it('should handle delayed responses', async () => {
      const start = Date.now();
      const response = await request(app).get('/slow');
      const duration = Date.now() - start;
      expect(response.status).toBe(200);
      expect(duration).toBeGreaterThanOrEqual(2000);
    });

    it('should handle conditional responses', async () => {
      const premiumResponse = await request(app).get('/conditional?type=premium');
      expect(premiumResponse.status).toBe(200);
      expect(premiumResponse.body.message).toBe('Premium content');

      const basicResponse = await request(app).get('/conditional?type=basic');
      expect(basicResponse.status).toBe(200);
      expect(basicResponse.body.message).toBe('Basic content');
    });

    it('should handle 404 for unknown routes', async () => {
      const response = await request(app).get('/unknown');
      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Not Found');
    });

    it('should handle template errors gracefully', async () => {
      const response = await request(app).get('/template-error');
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Internal server error');
    });
  });

  describe('Graceful Shutdown', () => {
    it('should handle shutdown signals', async () => {
      await server.loadConfig();
      server.setupRoutes();
      await server.start(4000);

      const shutdownPromise = new Promise(resolve => {
        process.once('serverClosed', resolve);
      });

      process.emit('SIGTERM');
      expect(server.isShuttingDown).toBe(true);

      await shutdownPromise;
    });

    it('should reject new requests during shutdown', async () => {
      await server.loadConfig();
      server.setupRoutes();
      server.isShuttingDown = true;

      const response = await request(server.app).get('/users');
      expect(response.status).toBe(503);
      expect(response.body.error).toBe('Server is shutting down');
    });
  });
}); 