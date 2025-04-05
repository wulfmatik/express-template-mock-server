# Easy Mock Server

A simple CLI tool for creating mock HTTP servers for rapid prototyping and testing.

## Features

- Declarative route configuration
- Dynamic responses with Handlebars templating
- Hot reloading on config changes
- Latency simulation
- Error simulation

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

- `method`: HTTP method (GET, POST, etc.)
- `path`: Route path (supports params like `/users/:id`)
- `response`: Response data (supports Handlebars templating)
- `delay`: Response delay in milliseconds
- `errorCode`: Force specific HTTP error code

## License

ISC 