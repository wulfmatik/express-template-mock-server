# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2023-04-05

### Added
- Initial release of the easy-mock-server
- Support for dynamic template responses using Handlebars
- Path parameters, query parameters, and body data in templates
- Conditional responses based on request query, headers, or body
- Custom response headers with template support
- Error simulation with custom status codes and messages
- Delayed responses for simulating slow APIs
- Built-in template helpers: now, random, uuid, responseTime
- Global headers for all responses
- Configuration hot reloading
- Comprehensive test coverage
- Graceful shutdown handling 