# Express Template Mock Server

[![npm version](https://img.shields.io/npm/v/express-template-mock-server.svg)](https://www.npmjs.com/package/express-template-mock-server)
[![Test Coverage](https://img.shields.io/codecov/c/github/wulfmatik/express-template-mock-server/main.svg)](https://codecov.io/gh/wulfmatik/express-template-mock-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

A powerful, flexible mock server built on Express with template support for dynamic responses.

## Features

- **Dynamic Responses**: Use Handlebars templates for flexible response generation
- **Template Variables**: Built-in variables like `{{id}}`, `{{random}}`, `{{now}}`, and `{{uuid}}`
- **Custom Headers**: Set global and route-specific headers
- **Delay Simulation**: Test your application with simulated network delays
- **Conditional Responses**: Return different responses based on request parameters
- **CORS Support**: Pre-configured for cross-origin requests
- **Middleware Support**: Custom middleware for advanced use cases

## Installation

### Local Installation (recommended)

```bash
npm install express-template-mock-server --save-dev
```

### Global Installation

```bash
npm install -g express-template-mock-server
```

## Quick Start

1. Create a `mocks.json` file in your project root:

```json
{
  "port": 3000,
  "headers": {
    "X-Powered-By": "Express Template Mock Server"
  },
  "routes": [
    {
      "path": "/users/:id",
      "method": "GET",
      "response": {
        "status": 200,
        "body": {
          "id": "{{id}}",
          "name": "User {{id}}",
          "createdAt": "{{now}}"
        }
      }
    }
  ]
}
```

2. Start the server:

```bash
npx express-template-mock-server
```

Or if installed globally:

```bash
express-template-mock-server
```

3. Access your mock API at `http://localhost:3000/users/123`

## Configuration

### Environment Variables

- `PORT`: Set the server port (default: 3000)
- `CONFIG_PATH`: Path to your mocks.json file (default: ./mocks.json)
- `CORS_ENABLED`: Enable CORS (default: true)
- `AUTO_RELOAD`: Enable hot reloading of config (default: true)

### Route Properties

- `method`: HTTP method (GET, POST, PUT, PATCH, DELETE, OPTIONS)
- `path`: URL path, can include parameters like `:id`
- `response`: Response body (object, array, or string)
- `statusCode`: HTTP status code (default: 200)
- `delay`: Response delay in milliseconds
- `headers`: Custom response headers
- `conditions`: Requirements for the route to match (query, body, headers)
- `fallback`: Response to use when conditions don't match
- `errorCode`: HTTP error code to return
- `errorMessage`: Custom error message

### Template Variables

- `{{path_parameter}}`: Any path parameter (e.g., `{{id}}` for `/users/:id`)
- `{{body.property}}`: Any property from the request body
- `{{query.parameter}}`: Any query parameter
- `{{headers.name}}`: Any request header
- `{{now}}`: Current date and time
- `{{uuid}}`: Random UUID v4
- `{{random min max}}`: Random number between min and max
- `{{responseTime}}`: Response time in milliseconds

## Example Configuration

```json
{
  "routes": [
    {
      "method": "GET",
      "path": "/users/:id",
      "response": {
        "id": "{{id}}",
        "name": "User {{id}}",
        "createdAt": "{{now}}"
      }
    },
    {
      "method": "POST",
      "path": "/users",
      "response": {
        "id": "{{random 1000 9999}}",
        "name": "{{body.name}}",
        "createdAt": "{{now}}"
      },
      "headers": {
        "X-Created-At": "{{now}}",
        "X-Request-ID": "{{uuid}}"
      }
    },
    {
      "method": "GET",
      "path": "/error",
      "errorCode": 500,
      "errorMessage": "Custom error message"
    },
    {
      "method": "GET",
      "path": "/conditional",
      "conditions": {
        "query": {
          "type": "premium"
        }
      },
      "response": {
        "message": "Premium content",
        "features": ["advanced", "premium"]
      },
      "fallback": {
        "message": "Basic content",
        "features": ["basic"]
      }
    }
  ],
  "globals": {
    "headers": {
      "X-Powered-By": "Express Template Mock Server",
      "X-Response-Time": "{{responseTime}}"
    }
  }
}
```

## Error Handling

The server provides detailed error messages for:
- Missing or invalid configuration files
- Malformed JSON in configuration
- Template processing errors
- Invalid route definitions

Errors are logged to the console and returned as JSON responses with appropriate HTTP status codes.

## License

ISC

