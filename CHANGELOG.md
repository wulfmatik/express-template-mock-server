# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 2.0.0 (2025-04-23)

### Breaking Changes
- Renamed package from 'easy-mock-server' to 'express-template-mock-server'
- Changed license from ISC to MIT

### Improvements
- Updated README.md with more comprehensive documentation
- Added security headers (X-Content-Type-Options, X-Frame-Options) by default
- Enhanced error handling for template variables
- Updated all branding references in code and documentation

## 1.1.1 (2025-04-22)

### Improvements
- Fixed TypeScript module declaration to correctly reference package name
- Improved middleware organization for better maintainability
- Enhanced responseTime helper to better handle missing startTime
- Improved graceful shutdown handling
- Removed unused fastify dependency
- Updated documentation to consistently use the new package name
- Code quality and organization improvements

## 1.1.0 (2025-04-22)

### Features
- Added configurable CORS support with full customization options
- Ability to enable/disable CORS completely
- TypeScript type definitions for CORS options

## 1.0.0 (2025-04-05)

### Features
- Initial release
- Dynamic template-based responses
- Handlebars template engine with custom helpers
- Conditional responses based on query parameters, headers, or body
- Custom header support (global and per-route)
- Error simulation with custom status codes and messages
- Response delays for testing latency
- Hot reloading of configuration
- Template helpers: now, random, uuid, responseTime
- Security headers included by default
- Graceful shutdown handling
- TypeScript type definitions

### Added
- Initial release of the easy-mock-server
- Path parameters, query parameters, and body data in templates
- Conditional responses based on request query, headers, or body
- Custom response headers with template support
- Delayed responses for simulating slow APIs
- Built-in template helpers: now, random, uuid, responseTime
- Global headers for all responses
- Configuration hot reloading
- Comprehensive test coverage
- Graceful shutdown handling 