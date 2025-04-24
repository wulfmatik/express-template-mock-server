// Mock console.log to prevent test output
global.console.log = jest.fn();

// Mock process.exit to prevent actual process termination
jest.spyOn(process, 'exit').mockImplementation(() => {});

// Mock setTimeout and clearTimeout
jest.spyOn(global, 'setTimeout');
jest.spyOn(global, 'clearTimeout');

// Mock setImmediate and clearImmediate
jest.spyOn(global, 'setImmediate');
jest.spyOn(global, 'clearImmediate');

// Mock process signals
jest.spyOn(process, 'on');
jest.spyOn(process, 'removeListener');

// Mock fs promises
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    unlink: jest.fn()
  }
}));

// Mock chokidar
jest.mock('chokidar', () => ({
  watch: jest.fn().mockReturnValue({
    on: jest.fn().mockReturnThis(),
    close: jest.fn().mockResolvedValue()
  })
}));

// Mock cors
jest.mock('cors', () => {
  return jest.fn().mockReturnValue((req, res, next) => next());
});

// Mock express
jest.mock('express', () => {
  const express = () => {
    const app = {
      use: jest.fn().mockReturnThis(),
      get: jest.fn().mockReturnThis(),
      post: jest.fn().mockReturnThis(),
      put: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      options: jest.fn().mockReturnThis(),
      listen: jest.fn((port, callback) => {
        if (callback) callback();
        return {
          close: jest.fn((cb) => cb && cb())
        };
      }),
      close: jest.fn(),
      removeAllListeners: jest.fn(),
      emit: jest.fn(),
      all: jest.fn().mockReturnThis()
    };
    return app;
  };
  express.json = jest.fn().mockReturnValue((req, res, next) => next());
  express.urlencoded = jest.fn().mockReturnValue((req, res, next) => next());
  express.static = jest.fn().mockReturnValue((req, res, next) => next());
  return express;
}); 