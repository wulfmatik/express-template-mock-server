# Express Template Mock Server

[![npm version](https://img.shields.io/npm/v/express-template-mock-server.svg)](https://www.npmjs.com/package/express-template-mock-server)
[![Test Coverage](https://img.shields.io/codecov/c/github/wulfmatik/express-template-mock-server/main.svg)](https://codecov.io/gh/wulfmatik/express-template-mock-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

> A powerful, zero-config mock server for rapid API development and testing with dynamic template-driven responses.

Stop waiting for backend APIs to be ready or writing complex mocks for your frontend. Express Template Mock Server lets you simulate any API with dynamic responses in seconds.

## 🚀 Why Choose Express Template Mock Server?

- **Zero Config Setup**: Get running in under 60 seconds
- **Dynamic Data**: Generate realistic data with built-in template helpers
- **Stateful Responses**: Simulate real-world API behaviors with conditional responses
- **Frontend-First Development**: Build frontends independently from backend development
- **Test Edge Cases**: Easily simulate errors, delays, and various response scenarios
- **Live Reload**: Configuration changes apply instantly without restart

## 🛠️ Features

| Feature | Description |
|---------|-------------|
| **Dynamic Responses** | Use Handlebars syntax to create flexible, realistic responses |
| **Path & Query Parameters** | Access route parameters like `{{id}}` or query values directly in templates |
| **JSON & Form Data** | Full support for parsing and responding to various request types |
| **Conditional Responses** | Return different responses based on headers, query params, or body content |
| **Error Simulation** | Test error handling with customized status codes and messages |
| **Delayed Responses** | Simulate slow networks to test loading states and timeouts |
| **CORS Support** | Configure cross-origin requests for frontend development |
| **Hot Reloading** | Changes to your mock configuration apply instantly |
| **Template Helpers** | Generate realistic data with `{{now}}`, `{{random}}`, `{{uuid}}` |
| **Security Headers** | Built-in security headers for realistic API simulation |

## 📦 Installation

### Local Installation (recommended)

```bash
npm install express-template-mock-server --save-dev
```

### Global Installation

```bash
npm install -g express-template-mock-server
```

## 🚀 Quick Start

### 1. Create a `mocks.json` file in your project:

```json
{
  "port": 3000,
  "routes": [
    {
      "path": "/users/:id",
      "method": "GET",
      "response": {
        "id": "{{id}}",
        "name": "User {{id}}",
        "email": "user{{id}}@example.com",
        "createdAt": "{{now}}"
      }
    }
  ]
}
```

### 2. Start the server:

```bash
npx express-template-mock-server
```

### 3. Access your mock API:

```bash
curl http://localhost:3000/users/123
```

Response:
```json
{
  "id": "123",
  "name": "User 123",
  "email": "user123@example.com", 
  "createdAt": "2023-11-24T14:32:10.456Z"
}
```

## 📖 Practical Examples

### User Authentication Flow

```json
{
  "routes": [
    {
      "path": "/auth/login",
      "method": "POST",
      "conditions": {
        "body": {
          "username": "admin",
          "password": "password"
        }
      },
      "response": {
        "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        "user": {
          "id": "1001",
          "username": "admin",
          "role": "administrator"
        }
      },
      "fallback": {
        "status": 401,
        "body": {
          "error": "Invalid credentials"
        }
      }
    },
    {
      "path": "/users/profile",
      "method": "GET",
      "conditions": {
        "headers": {
          "authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
        }
      },
      "response": {
        "id": "1001",
        "username": "admin",
        "email": "admin@example.com",
        "profile": {
          "fullName": "Admin User",
          "avatar": "https://randomuser.me/api/portraits/men/1.jpg",
          "preferences": {
            "theme": "dark",
            "notifications": true
          }
        }
      },
      "fallback": {
        "status": 401,
        "body": {
          "error": "Unauthorized access"
        }
      }
    }
  ]
}
```

### E-commerce Product Listing

```json
{
  "routes": [
    {
      "path": "/products",
      "method": "GET",
      "response": {
        "products": [
          {
            "id": "{{random 1000 9999}}",
            "name": "Premium Headphones",
            "price": 129.99,
            "rating": "{{random 1 5}}.{{random 0 9}}",
            "inStock": true
          },
          {
            "id": "{{random 1000 9999}}",
            "name": "Wireless Mouse",
            "price": 49.99,
            "rating": "{{random 1 5}}.{{random 0 9}}",
            "inStock": true
          },
          {
            "id": "{{random 1000 9999}}",
            "name": "Mechanical Keyboard",
            "price": 89.99,
            "rating": "{{random 1 5}}.{{random 0 9}}",
            "inStock": false
          }
        ],
        "totalCount": 3,
        "page": "{{query.page}}",
        "pageSize": "{{query.limit}}"
      }
    },
    {
      "path": "/products/:id",
      "method": "GET",
      "response": {
        "id": "{{id}}",
        "name": "Product {{id}}",
        "description": "Detailed description for product {{id}}",
        "price": "{{random 10 200}}.99",
        "images": [
          "https://example.com/products/{{id}}/1.jpg",
          "https://example.com/products/{{id}}/2.jpg"
        ],
        "specifications": {
          "weight": "{{random 100 5000}}g",
          "dimensions": "{{random 10 50}}x{{random 10 50}}x{{random 5 20}}cm"
        }
      }
    }
  ]
}
```

## ⚙️ Configuration Options

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `CONFIG_PATH` | Path to your mocks.json file | `./mocks.json` |
| `CORS_ENABLED` | Enable CORS support | `true` |
| `AUTO_RELOAD` | Enable hot reloading | `true` |
| `DEBUG` | Enable debug logging | `false` |

### Route Configuration

```json
{
  "routes": [
    {
      "method": "GET",                       // HTTP method
      "path": "/users/:id",                  // URL path with optional parameters
      "delay": 2000,                         // Response delay in milliseconds
      "response": {                          // Response object
        "id": "{{id}}",                      // Path parameter from URL
        "email": "{{query.email}}",          // Query parameter
        "name": "{{body.name}}",             // Body parameter
        "token": "{{headers.authorization}}" // Header value
      },
      "statusCode": 200,                     // HTTP status code (default: 200)
      "headers": {                           // Custom response headers
        "X-Custom-Header": "Custom Value"
      },
      "conditions": {                        // Requirements for this route to match
        "query": { "type": "premium" },
        "headers": { "authorization": "Bearer *" },
        "body": { "role": "admin" }
      },
      "fallback": {                          // Response when conditions don't match
        "status": 403,
        "body": { "error": "Access denied" }
      }
    }
  ]
}
```

### Template Helpers

| Helper | Example | Description |
|--------|---------|-------------|
| `{{now}}` | `"createdAt": "{{now}}"` | Current date/time in ISO format |
| `{{uuid}}` | `"id": "{{uuid}}"` | Random UUID v4 |
| `{{random min max}}` | `"value": "{{random 1 100}}"` | Random number in range |
| `{{responseTime}}` | `"elapsed": "{{responseTime}}ms"` | Time since request started |
| Path parameters | `"id": "{{id}}"` | Route parameters from URL |
| Query parameters | `"sort": "{{query.sort}}"` | Values from the query string |
| Body fields | `"name": "{{body.name}}"` | Values from the request body |
| Headers | `"token": "{{headers.authorization}}"` | Values from request headers |

## 🔍 Testing & Error Scenarios

### Response Delay Simulation

```json
{
  "path": "/slow-connection",
  "method": "GET",
  "delay": 3000,
  "response": {
    "message": "This response was delayed by 3 seconds"
  }
}
```

### Error Responses

```json
{
  "path": "/server-error",
  "method": "GET",
  "errorCode": 500,
  "errorMessage": "Simulated server error for testing"
}
```

### Conditional Responses

```json
{
  "path": "/subscription",
  "method": "GET",
  "conditions": {
    "headers": {
      "x-subscription-tier": "premium"
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
```

## 🪲 Troubleshooting

Common issues and their solutions:

- **Port already in use**: Set a different port with `PORT=3001 npx express-template-mock-server`
- **Configuration not updating**: Make sure `AUTO_RELOAD=true` is set
- **Invalid JSON**: Check your mocks.json for syntax errors
- **CORS issues**: Ensure CORS is enabled with `CORS_ENABLED=true`

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📝 License

MIT

