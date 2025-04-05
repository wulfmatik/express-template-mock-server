# Easy Mock Server

A flexible and powerful mock server for development and testing. Create realistic API mocks with dynamic data, conditional responses, and simulated network conditions.

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

## Installation

```bash
# Local installation (recommended)
npm install easy-mock-server --save-dev

# Global installation
npm install -g easy-mock-server
```

## Quick Start

1. Create a `mocks.json` file:

```json
{
  "globals": {
    "headers": {
      "X-Powered-By": "Easy Mock Server",
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
npx easy-mock-server mocks.json

# Using global installation
easy-mock-server mocks.json

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
  "error": "Internal server error",
  "message": "Detailed error message",
  "path": "/api/endpoint",
  "method": "GET"
}
```

## Stability Features

- **Graceful Shutdown**: 
  - Handles SIGTERM/SIGINT signals
  - Drains existing requests
  - 10-second shutdown timeout

- **Hot Reload**:
  - Watches config file changes
  - Reloads routes automatically
  - Preserves existing connections

- **Security**:
  - Basic security headers
  - JSON/form data parsing
  - Error sanitization

## Troubleshooting

Common issues and solutions:

1. **Server won't start**:
   - Check port availability
   - Verify config file path
   - Check JSON syntax

2. **Template errors**:
   - Verify variable names
   - Check helper function usage
   - Validate JSON structure

3. **Routes not matching**:
   - Check path parameters
   - Verify condition syntax
   - Compare request format

4. **Hot reload issues**:
   - Check file permissions
   - Verify JSON validity
   - Check console errors

## Development Setup

### Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)
- Git

### Getting Started

1. Clone the repository:
```bash
git clone https://github.com/yourusername/easy-mock-server.git
cd easy-mock-server
```

2. Install dependencies:
```bash
npm install
```

3. Create a development configuration:
```bash
cp mocks.json mocks.dev.json
```

4. Start the development server:
```bash
npm start
```

### Development Workflow

1. **Making Changes**:
   - Create a new branch: `git checkout -b feature/your-feature`
   - Make your changes
   - Test locally using `npm start`
   - Commit changes: `git commit -m "Description of changes"`

2. **Testing**:
   - Start the server: `npm start`
   - Test endpoints using curl or Postman
   - Check logs for any errors
   - Verify hot reloading works

3. **Debugging**:
   - Use `console.log()` for basic debugging
   - For advanced debugging, use Node.js inspector:
     ```bash
     node --inspect src/cli/index.js mocks.json
     ```
   - Open Chrome DevTools and connect to the debugger

### Common Development Tasks

1. **Adding New Features**:
   - Add new route handlers in `src/lib/server.js`
   - Update configuration validation
   - Add new template helpers
   - Update documentation

2. **Fixing Bugs**:
   - Reproduce the issue
   - Add test cases
   - Fix the code
   - Verify the fix
   - Update documentation if needed

3. **Testing Configuration Changes**:
   - Edit `mocks.dev.json`
   - Server should reload automatically
   - Test the changes
   - Update documentation if needed

### Development Tips

1. **Hot Reloading**:
   - Changes to `mocks.dev.json` trigger automatic reload
   - Changes to server code require restart
   - Use `npm run dev` for development mode

2. **Logging**:
   - Server logs are in the console
   - Error details are logged with stack traces
   - Request/response details are logged

3. **Performance**:
   - Monitor memory usage
   - Check response times
   - Watch for memory leaks

4. **Security**:
   - Validate all inputs
   - Sanitize error messages
   - Use secure headers
   - Handle sensitive data properly

### Development Environment

1. **Recommended Tools**:
   - VS Code with ESLint extension
   - Postman for API testing
   - Chrome DevTools for debugging
   - Git for version control

2. **Environment Variables**:
   ```bash
   # .env.development
   PORT=3000
   MOCK_CONFIG_PATH=mocks.dev.json
   NODE_ENV=development
   ```

3. **Code Style**:
   - Follow ESLint rules
   - Use consistent formatting
   - Add JSDoc comments
   - Write clear commit messages

### Troubleshooting Development Issues

1. **Server Won't Start**:
   - Check port availability
   - Verify config file path
   - Check for syntax errors
   - Look for missing dependencies

2. **Hot Reload Not Working**:
   - Check file permissions
   - Verify file watcher is running
   - Check for errors in console
   - Restart the server

3. **Template Errors**:
   - Check template syntax
   - Verify variable names
   - Check helper function usage
   - Look for missing context

4. **Performance Issues**:
   - Monitor memory usage
   - Check for memory leaks
   - Profile response times
   - Optimize template processing

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

ISC 