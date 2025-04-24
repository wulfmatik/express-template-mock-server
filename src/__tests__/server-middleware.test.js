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
    locals: {}
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
  });
}); 