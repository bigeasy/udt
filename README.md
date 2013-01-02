# UDT [![Build Status](https://secure.travis-ci.org/bigeasy/udt.png?branch=master)](http://travis-ci.org/bigeasy/udt)

A pure JavaScript implementation of UDP-based Data Transfer Protocol for Node.js
and Google Chrome sockets.

## Change Log

Changes for each release.

### Version 0.0.1

 * Remove Node.js 0.6 from Travis build. #22.
 * Assign `connect` event callback if provided to `connect` function. #20.
 * Add `.js` extension to test file names. #19.
 * Stop accepting new connections after `close` is called. #18.
 * Implement minimal listen-only server socket. #14.
 * Implement minimal connect-only client socket. #13.
 * Create UDP proxy. #8.
 * Implement UDT handshake. #5.
 * Create project and repository. #2.
