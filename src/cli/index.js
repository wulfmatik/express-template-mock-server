#!/usr/bin/env node

const MockServer = require('../lib/server');
const path = require('path');

const configPath = process.argv[2];
if (!configPath) {
  console.error('Please provide a path to the mock configuration file');
  process.exit(1);
}

const absoluteConfigPath = path.resolve(process.cwd(), configPath);
const server = new MockServer(absoluteConfigPath);

server.start().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
}); 