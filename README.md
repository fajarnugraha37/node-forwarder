<h1 align="center">
  <a href="https://github.com/fajarnugraha37/node-forwarder">
    <picture>
      <img height="500" alt="node-forwarder" src="https://raw.githubusercontent.com/fajarnugraha37/node-forwarder/refs/heads/main/docs/logo.webp">
    </picture>
  </a>
</h1>
<p align="center">
    <em><b>Node Forwarder</b> A simple, Request forwarder built with Node.js. It includes features like caching, rate limiting, blacklisting, whitelisting, etc. Designed for ease of use, and flexible.
    </em>
</p>

---
## ⚠️ **Attention**

This project, is currently under development and is not yet ready for use.

## Roadmap

- Protocol Support:
    - [X]  HTTP
    - [X]  HTTPS  
    - [ ]  Websocket
- Configuration support:
    - [X]  Dot Env file
    - [X]  JSON file
    - [ ]  YAML file
- Middleware Support:
    - [X]  Custom middleware when request comes (HTTP & HTTPS)
    - [X]  Custom middleware when response from remote server comes (HTTP & HTTPS)
    - [X]  Middleware when request CONNECT from client (HTTPS only)
- Rate Limiting Support: 
    - [ ]  By IP Address
    - [ ]  By Target Host
    - [ ]  By Path/URL
- Whitelisting Support:
    - [ ]  By IP Address
    - [ ]  By Target Host
- Blacklisting Support:
    - [ ]  By IP Address
    - [ ]  By Target Host
- Caching Support: 
    - [ ]  TTL for expiration.
    - [ ]  In-memory adapter
    - [ ]  Disk adapter
    - [ ]  Custom adapter 
    - [ ]  Automatic Cache Cleanup
    - [ ]  Compression support
    - [ ]  Pre-fetch scheduling
    - [ ]  Cache invalidation based on URL patterns/cache-control headers
- Monitoring support:
    - [X]  logging
    - [ ]  Trace Header
    - [ ]  Shadowing Request
- Authentication Support:
    - [X]  Proxy auth
    - [ ]  API key
    - [ ]  JWT
    - [ ]  OAuth
- Optimization:
    - [ ]  Request Throttling
    - [ ]  Retry Mechanism
    - [ ]  Content-Length Limit
    - [ ]  Request Timeout
- Deployment support:
    - [ ]  Docker
    - [ ]  Kubernetes
- Admin Dashboard:
    - [ ]  Admin dashboard
    - [ ]  Maintenance Mode
    - [ ]  Dynamic configuration
    - [ ]  Customize error messages

## Demo

## Architecture

## Quick Start

### Prerequisites
- Node v18.17.0+
- NPM 9.6.7+

### Installation
