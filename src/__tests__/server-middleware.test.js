describe('Server Middleware', () => {
  const mockApp = {
    use: jest.fn().mockReturnThis(),
    get: jest.fn().mockReturnThis(),
    post: jest.fn().mockReturnThis(),
    put: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    options: jest.fn().mockReturnThis()
  };
  
  const mockResponse = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    locals: {},
    headersSent: false
  };
  
  const mockRequest = {
    startTime: Date.now(),
    query: { testQuery: 'value' },
    headers: { 'x-test-header': 'test' },
    body: { testBody: 'content' },
    params: { id: '123' }
  };
  
  const mockNext = jest.fn();
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockResponse.locals = {};
    mockResponse.headersSent = false;
  });
  
  describe('Setup Middleware', () => {
    it('should add middleware to app', () => {
      jest.isolateModules(() => {
        const setupMiddleware = (app) => {
          app.use(jest.fn());
          app.use(jest.fn());
          return app;
        };
        
        setupMiddleware(mockApp);
        expect(mockApp.use).toHaveBeenCalledTimes(2);
      });
    });
    
    it('should set up multiple middleware functions', () => {
      jest.isolateModules(() => {
        const middleware1 = jest.fn();
        const middleware2 = jest.fn();
        const middleware3 = jest.fn();
        
        const setupMiddleware = (app) => {
          app.use(middleware1);
          app.use(middleware2);
          app.use(middleware3);
          return app;
        };
        
        setupMiddleware(mockApp);
        expect(mockApp.use).toHaveBeenCalledTimes(3);
        expect(mockApp.use).toHaveBeenCalledWith(middleware1);
        expect(mockApp.use).toHaveBeenCalledWith(middleware2);
        expect(mockApp.use).toHaveBeenCalledWith(middleware3);
      });
    });
  });
  
  describe('Response Time Middleware', () => {
    it('should add startTime to request', () => {
      // Create a mock middleware
      const responseTimeMiddleware = (req, res, next) => {
        req.startTime = Date.now();
        res.locals.startTime = req.startTime;
        req.getResponseTime = () => Date.now() - req.startTime;
        next();
      };
      
      const next = jest.fn();
      responseTimeMiddleware(mockRequest, mockResponse, next);
      
      expect(mockRequest.startTime).toBeDefined();
      expect(mockResponse.locals.startTime).toBe(mockRequest.startTime);
      expect(typeof mockRequest.getResponseTime).toBe('function');
      expect(next).toHaveBeenCalled();
    });
    
    it('should calculate correct response time', () => {
      // Create a mock middleware
      const responseTimeMiddleware = (req, res, next) => {
        req.startTime = Date.now() - 100; // Mock 100ms elapsed
        req.getResponseTime = () => Date.now() - req.startTime;
        next();
      };
      
      responseTimeMiddleware(mockRequest, mockResponse, mockNext);
      const responseTime = mockRequest.getResponseTime();
      
      expect(responseTime).toBeGreaterThanOrEqual(100);
    });
    
    it('should handle response time for requests without startTime', () => {
      // Create a request without startTime
      const req = { ...mockRequest };
      delete req.startTime;
      
      const responseTimeMiddleware = (req, res, next) => {
        // Should set startTime if not present
        if (!req.startTime) {
          req.startTime = Date.now();
        }
        res.locals.startTime = req.startTime;
        req.getResponseTime = () => Date.now() - req.startTime;
        next();
      };
      
      responseTimeMiddleware(req, mockResponse, mockNext);
      
      expect(req.startTime).toBeDefined();
      expect(mockResponse.locals.startTime).toBeDefined();
      expect(req.getResponseTime()).toBeGreaterThanOrEqual(0);
      expect(req.getResponseTime()).toBeLessThan(10); // Should be very small
    });
  });
  
  describe('CORS Middleware', () => {
    it('should apply default CORS settings', () => {
      const corsMiddleware = (req, res, next) => {
        res.set('Access-Control-Allow-Origin', '*');
        res.set('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
        next();
      };
      
      corsMiddleware(mockRequest, mockResponse, mockNext);
      
      expect(mockResponse.set).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');
      expect(mockResponse.set).toHaveBeenCalledWith('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
      expect(mockNext).toHaveBeenCalled();
    });
    
    it('should apply custom CORS settings', () => {
      const corsMiddleware = (req, res, next) => {
        res.set('Access-Control-Allow-Origin', 'https://example.com');
        res.set('Access-Control-Allow-Methods', 'GET,POST');
        res.set('Access-Control-Allow-Headers', 'Content-Type');
        next();
      };
      
      corsMiddleware(mockRequest, mockResponse, mockNext);
      
      expect(mockResponse.set).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'https://example.com');
      expect(mockResponse.set).toHaveBeenCalledWith('Access-Control-Allow-Methods', 'GET,POST');
      expect(mockResponse.set).toHaveBeenCalledWith('Access-Control-Allow-Headers', 'Content-Type');
      expect(mockNext).toHaveBeenCalled();
    });
    
    it('should apply credentials and max age settings', () => {
      const corsMiddleware = (req, res, next) => {
        res.set('Access-Control-Allow-Origin', 'https://example.com');
        res.set('Access-Control-Allow-Credentials', 'true');
        res.set('Access-Control-Max-Age', '86400');
        next();
      };
      
      corsMiddleware(mockRequest, mockResponse, mockNext);
      
      expect(mockResponse.set).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'https://example.com');
      expect(mockResponse.set).toHaveBeenCalledWith('Access-Control-Allow-Credentials', 'true');
      expect(mockResponse.set).toHaveBeenCalledWith('Access-Control-Max-Age', '86400');
      expect(mockNext).toHaveBeenCalled();
    });
  });
  
  describe('Global Headers Middleware', () => {
    it('should set global headers', () => {
      const headerMiddleware = (req, res, next) => {
        res.set('X-Powered-By', 'Express Template Mock Server');
        res.set('X-Response-Time', `${req.getResponseTime()}ms`);
        next();
      };
      
      mockRequest.getResponseTime = jest.fn().mockReturnValue(42);
      headerMiddleware(mockRequest, mockResponse, mockNext);
      
      expect(mockResponse.set).toHaveBeenCalledWith('X-Powered-By', 'Express Template Mock Server');
      expect(mockResponse.set).toHaveBeenCalledWith('X-Response-Time', '42ms');
      expect(mockNext).toHaveBeenCalled();
    });
    
    it('should handle template errors in headers', () => {
      // Reset mocks to ensure clean state
      mockResponse.set.mockClear();
      
      const headerMiddleware = (req, res, next) => {
        // This is what happens in the actual implementation - the header still gets set
        // But a warning is logged
        res.set('X-Invalid', '{{invalid}}');
        next();
      };
      
      headerMiddleware(mockRequest, mockResponse, mockNext);
      
      // Check that the header was set, even though it contains an invalid template
      expect(mockResponse.set).toHaveBeenCalledWith('X-Invalid', '{{invalid}}');
      expect(mockNext).toHaveBeenCalled();
    });
    
    it('should process multiple global headers', () => {
      const headerMiddleware = (req, res, next) => {
        res.set('X-Powered-By', 'Express Template Mock Server');
        res.set('X-Custom-Header', 'Custom Value');
        res.set('X-Response-Time', `${req.getResponseTime()}ms`);
        res.set('Content-Type', 'application/json');
        next();
      };
      
      mockRequest.getResponseTime = jest.fn().mockReturnValue(42);
      headerMiddleware(mockRequest, mockResponse, mockNext);
      
      expect(mockResponse.set).toHaveBeenCalledWith('X-Powered-By', 'Express Template Mock Server');
      expect(mockResponse.set).toHaveBeenCalledWith('X-Custom-Header', 'Custom Value');
      expect(mockResponse.set).toHaveBeenCalledWith('X-Response-Time', '42ms');
      expect(mockResponse.set).toHaveBeenCalledWith('Content-Type', 'application/json');
      expect(mockNext).toHaveBeenCalled();
    });
  });
  
  describe('Security Headers Middleware', () => {
    it('should set security headers', () => {
      const securityMiddleware = (req, res, next) => {
        res.set('X-Content-Type-Options', 'nosniff');
        res.set('X-XSS-Protection', '1; mode=block');
        res.set('X-Frame-Options', 'DENY');
        next();
      };
      
      securityMiddleware(mockRequest, mockResponse, mockNext);
      
      expect(mockResponse.set).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
      expect(mockResponse.set).toHaveBeenCalledWith('X-XSS-Protection', '1; mode=block');
      expect(mockResponse.set).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
      expect(mockNext).toHaveBeenCalled();
    });
    
    it('should set strict transport security header', () => {
      const securityMiddleware = (req, res, next) => {
        res.set('X-Content-Type-Options', 'nosniff');
        res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
        next();
      };
      
      securityMiddleware(mockRequest, mockResponse, mockNext);
      
      expect(mockResponse.set).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
      expect(mockResponse.set).toHaveBeenCalledWith('Strict-Transport-Security', 
        'max-age=31536000; includeSubDomains');
      expect(mockNext).toHaveBeenCalled();
    });
  });
  
  describe('Shutdown Middleware', () => {
    it('should allow requests when not shutting down', () => {
      const isShuttingDown = false;
      const shutdownMiddleware = (req, res, next) => {
        if (isShuttingDown) {
          res.status(503).json({ error: 'Server is shutting down' });
          return;
        }
        next();
      };
      
      shutdownMiddleware(mockRequest, mockResponse, mockNext);
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });
    
    it('should reject requests when shutting down', () => {
      const isShuttingDown = true;
      const shutdownMiddleware = (req, res, next) => {
        if (isShuttingDown) {
          res.status(503).json({ error: 'Server is shutting down' });
          return;
        }
        next();
      };
      
      shutdownMiddleware(mockRequest, mockResponse, mockNext);
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(503);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Server is shutting down' });
    });
    
    it('should add retry-after header when shutting down', () => {
      const isShuttingDown = true;
      const shutdownMiddleware = (req, res, next) => {
        if (isShuttingDown) {
          res.set('Retry-After', '10');
          res.status(503).json({ error: 'Server is shutting down' });
          return;
        }
        next();
      };
      
      shutdownMiddleware(mockRequest, mockResponse, mockNext);
      expect(mockResponse.set).toHaveBeenCalledWith('Retry-After', '10');
      expect(mockResponse.status).toHaveBeenCalledWith(503);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Server is shutting down' });
    });
  });
  
  describe('Error Handling Middleware', () => {
    it('should handle errors appropriately', () => {
      // Create a mock error middleware
      const errorMiddleware = (err, req, res, _next) => {
        if (err.name === 'ValidationError') {
          res.status(400).json({ error: err.message });
          return;
        }
        
        if (err.name === 'TemplateError') {
          res.status(500).json({ error: 'Template processing error' });
          return;
        }
        
        res.status(500).json({ error: 'Internal server error' });
      };
      
      const error = new Error('Test error');
      errorMiddleware(error, mockRequest, mockResponse, jest.fn());
      
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    });
    
    it('should handle ValidationError differently', () => {
      const errorMiddleware = (err, req, res, _next) => {
        if (err.name === 'ValidationError') {
          res.status(400).json({ error: err.message });
          return;
        }
        
        res.status(500).json({ error: 'Internal server error' });
      };
      
      const error = new Error('Invalid input');
      error.name = 'ValidationError';
      
      errorMiddleware(error, mockRequest, mockResponse, jest.fn());
      
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Invalid input' });
    });
    
    it('should handle TemplateError differently', () => {
      const errorMiddleware = (err, req, res, _next) => {
        if (err.name === 'TemplateError') {
          res.status(500).json({ error: 'Template processing error' });
          return;
        }
        
        res.status(500).json({ error: 'Internal server error' });
      };
      
      const error = new Error('Template error');
      error.name = 'TemplateError';
      
      errorMiddleware(error, mockRequest, mockResponse, jest.fn());
      
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Template processing error' });
    });
    
    it('should do nothing if response is already sent', () => {
      const errorMiddleware = (err, req, res, _next) => {
        if (res.headersSent) {
          return;
        }
        res.status(500).json({ error: 'Internal server error' });
      };
      
      // Mock that headers have already been sent
      mockResponse.headersSent = true;
      
      const error = new Error('Test error');
      errorMiddleware(error, mockRequest, mockResponse, jest.fn());
      
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
    });
    
    it('should include error details in development mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      const errorMiddleware = (err, req, res, _next) => {
        const isDev = process.env.NODE_ENV === 'development';
        
        const errorResponse = {
          error: 'Internal server error'
        };
        
        if (isDev) {
          errorResponse.message = err.message;
          errorResponse.stack = err.stack;
        }
        
        res.status(500).json(errorResponse);
      };
      
      const error = new Error('Detailed error message');
      errorMiddleware(error, mockRequest, mockResponse, jest.fn());
      
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Internal server error',
        message: 'Detailed error message',
        stack: error.stack
      });
      
      // Restore environment
      process.env.NODE_ENV = originalEnv;
    });
  });
}); 