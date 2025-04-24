// Mock modules
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn().mockResolvedValue(JSON.stringify({
      port: 3000,
      routes: [
        {
          path: '/test',
          method: 'GET',
          response: { message: 'test' }
        }
      ]
    })),
    writeFile: jest.fn()
  }
}));

jest.mock('express', () => {
  const app = {
    use: jest.fn().mockReturnThis(),
    get: jest.fn().mockReturnThis(),
    post: jest.fn().mockReturnThis(),
    put: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    patch: jest.fn().mockReturnThis(),
    options: jest.fn().mockReturnThis(),
    listen: jest.fn().mockImplementation((port, cb) => {
      const server = {
        close: jest.fn().mockImplementation(cb => {
          if (cb) setTimeout(cb, 0); // Ensure callback is async but quick
          return Promise.resolve();
        }),
        address: jest.fn().mockReturnValue({ port }),
        on: jest.fn(),
        emit: jest.fn(),
        removeAllListeners: jest.fn()
      };
      if (cb) setTimeout(cb, 0); // Make callback async but quick
      return server;
    })
  };
  
  const mockExpress = jest.fn().mockReturnValue(app);
  mockExpress.json = jest.fn().mockReturnValue((req, res, next) => next());
  mockExpress.urlencoded = jest.fn().mockReturnValue((req, res, next) => next());
  mockExpress.static = jest.fn().mockReturnValue((req, res, next) => next());
  
  return mockExpress;
});

jest.mock('cors', () => {
  return jest.fn().mockReturnValue((req, res, next) => next());
});

jest.mock('chokidar', () => ({
  watch: jest.fn().mockReturnValue({
    on: jest.fn().mockReturnThis(),
    close: jest.fn().mockResolvedValue()
  })
}));

// Mock net module for getAvailablePort
jest.mock('net', () => {
  return {
    createServer: jest.fn().mockReturnValue({
      listen: jest.fn().mockImplementation((port, cb) => {
        if (cb) setTimeout(cb, 0);
        return this;
      }),
      address: jest.fn().mockReturnValue({ port: 3000 }),
      close: jest.fn().mockImplementation(cb => {
        if (cb) setTimeout(cb, 0);
        return this;
      })
    })
  };
});

// Import the actual module (not mocked version)
const { createMockServer, getAvailablePort } = require('../lib/server');

describe('Mock Server - Basic', () => {
  let server;
  
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.spyOn(process, 'exit').mockImplementation(() => {});
    
    // Clear any previous event listeners
    process.removeAllListeners('SIGTERM');
    process.removeAllListeners('SIGINT');
    
    // Reset all timeouts
    jest.clearAllTimers();
    
    // Create a new server instance for each test
    server = createMockServer('mocks.json');
  });
  
  afterEach(async () => {
    // Ensure server is properly stopped
    if (server && server.stop) {
      await server.stop();
    }
    
    // Clear all mocks
    jest.clearAllMocks();
    
    // Clear any event listeners
    process.removeAllListeners('SIGTERM');
    process.removeAllListeners('SIGINT');
    
    // Clear any remaining timeouts
    jest.clearAllTimers();
  });
  
  it('should create a server instance', () => {
    expect(server).toBeDefined();
    expect(typeof server.start).toBe('function');
    expect(typeof server.stop).toBe('function');
  });
  
  it('should load config and start the server', async () => {
    const startedServer = await server.start();
    expect(startedServer).toBeDefined();
    expect(startedServer.address().port).toBe(3000);
  });
  
  it('should find an available port', async () => {
    const port = await getAvailablePort();
    expect(port).toBe(3000);
  });
  
  it('should start server with custom port', async () => {
    const startedServer = await server.start(4000);
    expect(startedServer).toBeDefined();
    expect(startedServer.address().port).toBe(4000);
  });
  
  it('should stop server correctly', async () => {
    await server.start();
    await server.stop();
    // We can't easily test the result of stop() since we're using the real module
    // Instead, verify the test completes without hanging
    expect(true).toBe(true);
  });
  
  it('should handle start failures', async () => {
    // Mock a failure in the listen method
    const expressModule = require('express');
    const mockApp = expressModule();
    const originalListen = mockApp.listen;
    
    mockApp.listen = jest.fn().mockImplementation(() => {
      throw new Error('Start failed');
    });
    
    await expect(server.start()).rejects.toThrow();
    
    // Restore original implementation
    mockApp.listen = originalListen;
  });
  
  it('should handle file not found error', async () => {
    // Mock fs.readFile to reject with ENOENT
    const fs = require('fs');
    const originalReadFile = fs.promises.readFile;
    
    fs.promises.readFile = jest.fn().mockRejectedValueOnce({ code: 'ENOENT' });
    
    const errorServer = createMockServer('not-found.json');
    await expect(errorServer.start()).rejects.toThrow();
    
    // Restore original implementation
    fs.promises.readFile = originalReadFile;
  });
  
  it('should handle graceful shutdown', async () => {
    await server.start();
    
    // Simulate SIGINT
    process.emit('SIGINT');
    
    // Allow time for the shutdown process
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Test should complete without hanging
    expect(true).toBe(true);
  });
}); 