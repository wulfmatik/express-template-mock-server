# Express Template Mock Server

[![npm version](https://img.shields.io/npm/v/express-template-mock-server.svg)](https://www.npmjs.com/package/express-template-mock-server)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)
[![Test Coverage](https://img.shields.io/badge/coverage-100%25-brightgreen)](https://github.com/wulfmatik/express-template-mock-server)

A flexible and powerful HTTP mock server for development and testing. Create realistic API mocks with dynamic data, conditional responses, and simulated network conditions.

## Features

- **Dynamic Responses**: Template-based responses with variables and helpers
- **Conditional Responses**: Route-specific logic based on query params, headers, or body
- **Error Simulation**: Simulate API errors with custom status codes and messages
- **Response Delays**: Test app behavior under slow network conditions
- **Hot Reloading**: Changes to mock config apply instantly without restart
- **Custom Headers**: Set global and route-specific response headers
- **Template Helpers**: Built-in helpers for timestamps, UUIDs, and random data
- **Graceful Shutdown**: Clean server shutdown with request draining
- **Enhanced Error Handling**: Detailed error messages and validation
- **Security Headers**: Basic security headers included by default
- **Configurable CORS**: Customize Cross-Origin Resource Sharing settings
- **TypeScript Support**: Full TypeScript type definitions included

## Installation

```bash
# Local installation (recommended)
npm install express-template-mock-server --save-dev

# Global installation
npm install -g express-template-mock-server
```

## Quick Start

1. Create a `mocks.json` file:

```json
{
  "globals": {
    "headers": {
      "X-Powered-By": "Express Template Mock Server",
      "X-Response-Time": "{{responseTime}}",
      "Access-Control-Allow-Origin": "*"
    }
  },
  "routes": [
    {
      "method": "GET",
      "path": "/users",
      "response": [
        {
          "id": "{{random 1 1000}}",
          "name": "User {{random 1 100}}",
          "email": "user{{random 1 100}}@example.com",
          "createdAt": "{{now}}"
        }
      ]
    },
    {
      "method": "GET",
      "path": "/users/:id",
      "response": {
        "id": "{{id}}",
        "name": "User {{id}}",
        "requestId": "{{uuid}}",
        "timestamp": "{{now}}"
      }
    }
  ]
}
```

2. Start the server:

```bash
# Using npx (recommended)
npx express-template-mock-server mocks.json

# Using global installation
express-template-mock-server mocks.json

# Using package.json script
npm start
```

## Configuration

### Environment Variables

Create a `.env` file in your project root:

```bash
PORT=3000                    # Server port (default: 3000)
MOCK_CONFIG_PATH=mocks.json  # Config file path (default: mocks.json)
```

### Route Configuration

Each route in the `routes` array supports:

```typescript
{
  "method": string,        // HTTP method (GET, POST, PUT, DELETE, PATCH)
  "path": string,         // URL path (supports Express path params)
  "response": any,        // Response data (supports templates)
  "delay": number,        // Response delay in milliseconds
  "errorCode": number,    // HTTP error code (400-599)
  "errorMessage": string, // Custom error message
  "headers": object,      // Route-specific headers
  "conditions": {         // Request matching conditions
    "query": object,      // Match query parameters
    "headers": object,    // Match request headers
    "body": object       // Match request body
  },
  "fallback": any        // Response when conditions don't match
}
```

### Template System

#### Available Variables

- **Request Parameters**: `{{paramName}}`
  ```json
  { "path": "/users/:id", "response": { "userId": "{{id}}" } }
  ```

- **Query Parameters**: `{{queryName}}`
  ```json
  { "response": { "page": "{{page}}", "limit": "{{limit}}" } }
  ```

- **Body Fields**: `{{bodyField}}`
  ```json
  { "response": { "echo": "{{message}}" } }
  ```

- **Request Info**: 
  ```json
  {
    "response": {
      "method": "{{method}}",
      "path": "{{path}}",
      "authHeader": "{{headers.authorization}}"
    }
  }
  ```

#### Built-in Helpers

- **Current Timestamp**: 
  ```json
  { "timestamp": "{{now}}" }  // Returns ISO timestamp
  ```

- **Random Numbers**: 
  ```json
  { "id": "{{random 1 1000}}" }  // Random number between 1-1000
  ```

- **UUID Generation**: 
  ```json
  { "requestId": "{{uuid}}" }  // Generates UUID v4
  ```

- **Response Time**: 
  ```json
  { "latency": "{{responseTime}}" }  // Processing time in ms
  ```

## Advanced Usage

### Conditional Responses

Match specific request parameters:

```json
{
  "method": "GET",
  "path": "/api/content",
  "conditions": {
    "query": { 
      "type": "premium",
      "version": "v2"
    },
    "headers": {
      "authorization": "Bearer token",
      "x-api-version": "2.0"
    },
    "body": {
      "userId": "123"
    }
  },
  "response": {
    "type": "premium",
    "features": ["advanced", "premium"]
  },
  "fallback": {
    "type": "basic",
    "features": ["basic"]
  }
}
```

### Error Simulation

Simulate API errors:

```json
{
  "method": "GET",
  "path": "/error/unauthorized",
  "errorCode": 401,
  "errorMessage": "Invalid or expired token",
  "headers": {
    "WWW-Authenticate": "Bearer"
  }
}
```

### Global Headers

Apply headers to all responses:

```json
{
  "globals": {
    "headers": {
      "Access-Control-Allow-Origin": "*",
      "X-API-Version": "1.0",
      "X-Request-ID": "{{uuid}}",
      "X-Response-Time": "{{responseTime}}"
    }
  }
}
```

### CORS Configuration

Customize Cross-Origin Resource Sharing (CORS) settings:

```json
{
  "globals": {
    "cors": {
      "origin": "https://yourfrontend.com",
      "methods": ["GET", "POST", "PUT", "DELETE"],
      "allowedHeaders": ["Content-Type", "Authorization"],
      "exposedHeaders": ["X-Request-ID", "X-Response-Time"],
      "credentials": true,
      "maxAge": 86400
    }
  }
}
```

You can also disable CORS completely:

```json
{
  "globals": {
    "cors": false
  }
}
```

Or use default CORS settings (allow all origins):

```json
{
  "globals": {
    "cors": true
  }
}
```

If not specified, CORS is enabled with default settings (equivalent to `"cors": true`).

## Error Handling

The server provides detailed error information:

- **Config Validation**:
  - Invalid JSON syntax
  - Missing required fields
  - Invalid route configurations
  - Malformed conditions

- **Runtime Errors**:
  - Template processing errors
  - Request matching failures
  - Invalid response data
  - Server errors

Error responses include:
```json
{
  "error": "Error message"
}
```

## TypeScript Support

This package includes TypeScript type definitions. Import and use the types:

```typescript
import createMockServer, { MockServerConfig, RouteConfig } from 'express-template-mock-server';

// Example usage with TypeScript
const config: MockServerConfig = {
  routes: [
    {
      method: 'GET',
      path: '/api/users',
      response: [{ id: 1, name: 'User 1' }]
    }
  ]
};

// Write your config to a file and use it
const server = createMockServer('path/to/config.json');
server.start(3000).then(() => {
  console.log('Server started');
});
```

## Programmatic Usage

You can use the server programmatically in your tests or applications:

```javascript
const createMockServer = require('express-template-mock-server');

// Create a server instance
const server = createMockServer('./mocks.json');

// Start the server
async function startServer() {
  try {
    await server.start(3000);
    console.log('Mock server running on port 3000');
  } catch (error) {
    console.error('Failed to start server:', error);
  }
}

// Stop the server when done
async function stopServer() {
  await server.stop();
  console.log('Server stopped');
}

// Use in your tests
startServer()
  .then(() => {
    // Run your tests against the mock server
    return fetch('http://localhost:3000/users');
  })
  .then(response => response.json())
  .then(data => console.log(data))
  .then(stopServer)
  .catch(console.error);
```

## Security Considerations

The Express Template Mock Server is designed for development and testing environments. For security:

- **Do not use in production environments**
- Set up appropriate CORS restrictions for your dev environment
- Be aware that the server does not include authentication by default
- Consider using a reverse proxy like nginx when exposing to non-local environments

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Run the tests (`npm test`)
4. Commit your changes (`git commit -am 'Add some amazing feature'`)
5. Push to the branch (`git push origin feature/amazing-feature`)
6. Open a Pull Request

## License

This project is licensed under the ISC License - see the LICENSE file for details.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for the project history and version details. 
