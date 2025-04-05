# Easy Mock Server

A simple CLI tool for creating mock HTTP servers for rapid prototyping and testing.

## Features

- Declarative route configuration
- Dynamic responses with Handlebars templating
- Hot reloading on config changes
- Latency simulation
- Error simulation with custom messages
- Environment variable configuration
- Conditional responses based on request parameters
- Custom response headers
- Built-in template helpers
- Global response headers

## Installation

```bash
npm install -g easy-mock-server
```

## Usage

1. Create a mock configuration file (e.g., `mocks.json`):

```json
{
  "routes": [
    {
      "method": "GET",
      "path": "/users",
      "response": [
        { "id": 1, "name": "John Doe" }
      ]
    }
  ]
}
```

2. Start the server:

```bash
easy-mock-server path/to/mocks.json
```

Or using npm:

```bash
npm start
```

## Configuration Options

### Environment Variables

Create a `.env` file in your project root:

```bash
PORT=3000              # Server port (default: 3000)
MOCK_CONFIG_PATH=mocks.json  # Path to mock config (default: mocks.json)
```

### Route Configuration

Basic route properties:
- `method`: HTTP method (GET, POST, etc.)
- `path`: Route path (supports Express-style params like `/users/:id`)
- `response`: Response data (supports templating)
- `delay`: Response delay in milliseconds
- `errorCode`: Force specific HTTP error code
- `errorMessage`: Custom error message
- `headers`: Custom response headers
- `conditions`: Conditions for response selection
- `fallback`: Alternative response when conditions aren't met

### Template Variables

Available in responses and headers:
- Request parameters: `{{paramName}}`
- Query parameters: `{{queryName}}`
- Body parameters: `{{bodyName}}`
- Built-in helpers:
  - `{{now}}`: Current timestamp in ISO format
  - `{{random min max}}`: Random number between min and max
  - `{{uuid}}`: Generate a UUID v4
  - `{{responseTime}}`: Request processing time in ms

### Example Configuration

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
      },
      "headers": {
        "X-Request-ID": "{{uuid}}"
      }
    },
    {
      "method": "GET",
      "path": "/premium",
      "conditions": {
        "query": {
          "type": "premium"
        }
      },
      "response": {
        "message": "Premium content"
      },
      "fallback": {
        "message": "Basic content"
      }
    }
  ],
  "globals": {
    "headers": {
      "X-Powered-By": "Easy Mock Server",
      "X-Response-Time": "{{responseTime}}"
    }
  }
}
```

## Error Handling

The server includes comprehensive error handling:
- Invalid configuration validation
- JSON parsing errors
- Template processing errors
- Request handling errors
- Graceful server shutdown

## License

ISC 