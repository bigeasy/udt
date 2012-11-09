var dgram = require('dgram')
  , socket = dgram.createSocket('udp4')
  , packet = require('packet')
  , common = require('./common')
  , crypto = require('crypto')
  , Heap = require('./heap').Heap
  , dns = require('dns')
  , __slice = [].slice;

const CONTROL_TYPES = 'handshake'.split(/\s+/);
const MAX_MSG_NO = 0x1FFFFFFF;
const MAX_SEQ_NO = Math.pow(2, 31) - 1;

var socketId = crypto.randomBytes(4).readUInt32BE(0);

function nextSocketId () {
  if (socketId == 1) socketId = Math.pow(2, 32);
  return --socketId;
}

var Stream = require('stream');
var util = require('util');
var events = require('events');
var net = require('net');

// The start of time used in our high resolution timings.
var epoch = process.hrtime();

// Comparison operator for high-resolution time for use with heap.
function before (a, b) {
  if (a.when[0] < b.when[0]) return true;
  if (a.when[0] > b.when[0]) return false;
  return a.when[1] < b.when[1];
}

function die () {
  console.log.apply(console, __slice.call(arguments, 0));
  return process.exit(1);
}

function say () { return console.log.apply(console, __slice.call(arguments, 0)) }

function extend (to, from) {
  for (var key in from) to[key] = from[key];
  return to;
}

function parseDotDecimal (quad) {
  quad = quad.split('.');
  for (var i = 3, address = 0; i >= 0; i--) {
    address = address + quad[i] * Math.pow(256, i);
  }
  return address;
}

// Native control algorithm is an event emitter with certain properties. Ought
// to be simple enough for the user to implement a native control algorithm as
// an event emitter.
function NativeControlAlgorithm () {
  this.roundTripTime = 0;
  this.maximumSegmentSize = 0;
  this.estimatedBandwidth = 0;
  this.latestPacketSequenceNo = 0;
  this.windowSize = 16;
}
util.inherits(NativeControlAlgorithm, events.EventEmitter);

var sendQueue = new (function () {
  var queue = new Heap(before), sending = false;
  function enqueue (socket, packet, when) {
    queue.add({ socket: socket, packet: packet, when: when });
    if (!sending) poll();
  }
  function poll () {
    sending = true;
    if (queue.empty()) {
      sending = false;
    } else {
      send();
    }
  }
  function send () {
    var now = process.hrtime();
    if (before(queue.buf[0], { when: now })) {
      var entry = queue.pop(), socket = entry.socket, endPoint = socket._endPoint;
      endPoint.send(socket, packet);
      process.nextTick(poll);
    }
  }
  extend(this, { enqueue: enqueue });
})();

function Socket (options) {
  if (!(this instanceof Socket)) return new Socket();

  if (options === void(0)) options = {};

  Stream.call(this);

  this._socketId = nextSocketId();
  this._ccc = options.ccc || new NativeControlAlgorithm;
  this._serializer = common.serializer.createSerializer();
  this._parser = common.parser.createParser();
  this._packet = new Buffer(1500);
  this._sendQueue = new Heap;
  this._receiveQueue = new Heap;
}
util.inherits(Socket, Stream);

exports.Socket = Socket;

function exceptional () { return new Error(); }

// Wrapper around an underlying UDP datagram socket.
function EndPoint (local) {
  this.listeners = 0;
  this.dgram = dgram.createSocket('udp4');
  this.dgram.on('message', EndPoint.prototype.receive.bind(this));
  this.dgram.bind(local.port, local.address);
  this.local = this.dgram.address();
  this.packet = new Buffer(2048);
  this.sockets = {};
}
EndPoint.prototype.shakeHands = function (socket) {
  // Stash the socket so we can track it by the socket identifier.
  this.sockets[socket._socketId] = socket;

  // Start of client handshake.
  socket._status = "syn";

  // Send a handshake. Use hard-coded defaults for packet and window size.
  this.sendHandshake(socket,
  { control: 1
  , type: 0
  , additional: 0
  , timestamp: 0
  , destination: 0
  , version: 4
  , socketType: 1
  , sequence: socket._sequence
  , maxPacketSize: 1500
  , windowSize: 8192
  , connectionType: 1
  , socketId: socket._socketId
  , synCookie: 0
  , address: parseDotDecimal(socket._peer.address)
  });
}
EndPoint.prototype.shutdown = function (socket, send) {
  // Remove the socket from the stash.
  delete this.sockets[socket._socketId];

  // Zero the status.
  delete socket._status;

  var endPoint = this, dgram = endPoint.dgram;

  if (send) {
    var serializer = common.serializer, packet = endPoint.packet, peer = socket._peer;

    // Format a shutdown packet, simply a header packet of type shutdown.
    serializer.reset();
    serializer.serialize('header', 
    { control: 1
    , type: 0x5
    , additional: 0
    , timestamp: 0
    , destination: peer.socketId
    });
    serializer.write(packet);

    dgram.send(packet, 0, serializer.length, peer.port, peer.address, finalize);
  } else {
    finalize();
  }
  
  function finalize () {
    // If we were a bound listening socket, see if we ought to close.
    if (socket._listener && !--endPoint.listeners && endPoint.server._closing) {
      // This will unassign `endPoint.server`.
      endPoint.server.close();
    }
    // Dispose of the end point and UDP socket if it is no longer referenced.
    if (Object.keys(endPoint.sockets).length == 0) {
      delete endPoints[endPoint.local.port][endPoint.local.address];
      if (Object.keys(endPoints[endPoint.local.port]).length == 0) {
        delete endPoints[endPoint.local.port];
      }
      dgram.close();
    }
  }
}
// Send the handshake four times a second until we get a response, or until four
// seconds is up.
EndPoint.prototype.sendHandshake = function (socket, handshake) {
  var endPoint = this, count = 0, peer = socket._peer;
  socket._handshakeInterval = setInterval(function () {
    if (++count == 12) {
      clearInterval(socket._handshakeInterval);
      socket.emit('error', new Error('connection timeout'));
    } else {
      endPoint.send('handshake', handshake, socket._peer);
    }
  }, 250);
}
EndPoint.prototype.send = function (packetType, object, peer) {
  var serializer = common.serializer,
      packet = this.packet,
      dgram = this.dgram;
  
  serializer.reset();
  serializer.serialize(packetType, object);
  serializer.write(packet);

  dgram.send(packet, 0, serializer.length, peer.port, peer.address);
}
EndPoint.prototype.receive = function (msg, rinfo) {
  var endPoint = this, parser = common.parser, handler;
  parser.extract('header', function (header) {
    if (header.control) {
      if (header.destination) {
        // TODO: Socket not found...
        var socket = endPoint.sockets[header.destination];
        switch (header.type) {
        // Keep-alive.
        case 0x1:
          break;
        // Shutdown.
        case 0x5:
          endPoint.shutdown(socket, false);
          break;
        // Notifications from Bill the Cat. (Ack-ack.)
        case 0x6:
          break;
        default:
          var name = CONTROL_TYPES[header.type];
          parser.extract(name, endPoint[name].bind(endPoint, socket, header))
        }
      // Hmm... Do you explicitly enable rendezvous?
      } else if (header.type == 0 && endPoint.server) {
        parser.extract('handshake', endPoint.connect.bind(endPoint, rinfo, header))
      }
    } else {
    }
  });
  parser.parse(msg);
}
EndPoint.prototype.handshake = function (socket, header, handshake) {
  switch (socket._status) {
  case 'syn':
    // Only respond to an initial handshake.
    if (handshake.connectionType != 1) break;

    clearInterval(socket._handshakeInterval);

    socket._status = 'syn-ack';

    // Unify the packet object for serialization.
    handshake = extend(handshake, header);

    // Set the destination to nothing.
    handshake.destination = 0;

    // Select the lesser of the negotiated values.
    // TODO: Constants are a bad thing...
    handshake.maxPacketSize = Math.min(handshake.maxPacketSize, 1500);
    handshake.windowSize = Math.min(handshake.windowSize, 8192);
    handshake.connectionType = -1;

    this.sendHandshake(socket, handshake);
    break;
  case 'syn-ack':
    // Only respond to an follow-up handshake.
    if (handshake.connectionType != -1) break;

    clearInterval(socket._handshakeInterval);

    socket._status = 'connected';
    socket._peer.socketId = handshake.socketId;

    socket.emit('connect');
    break;
  }
}
EndPoint.prototype.connect = function (rinfo, header, handshake) {
  var endPoint = this, server = endPoint.server, timestamp = Math.floor(Date.now() / 6e4);

  // Do not accept new connections if the server is closing.
  if (server._closing) return;

  handshake = extend(handshake, header);

  if (handshake.connectionType == 1) {
    handshake.destination = handshake.socketId;
    handshake.synCookie = synCookie(rinfo, timestamp);
    endPoint.send('handshake', handshake, rinfo);
  } else if (handshakeWithValidCookie(handshake, timestamp)) {
    // Create the socket and initialize it as a listener.
    var socket = new Socket;

    socket._peer = rinfo;
    socket._endPoint = endPoint;
    socket._listener = true;
    socket._status = 'connected';

    // Increase the count of end point listeners.
    endPoint.listeners++;

    endPoint.sockets[socket._socketId] = socket;

    handshake.destination = handshake.socketId; 
    handshake.socketId = socket._socketId; 

    endPoint.send('handshake', handshake, rinfo);

    endPoint.server.emit('connection', socket);
  }

  function handshakeWithValidCookie (handshake, timestamp) {
    if (handshake.connectionType != -1) return false;
    if (synCookie(rinfo, timestamp) == handshake.synCookie) return true;
    if (synCookie(rinfo, timestamp - 1) == handshake.synCookie) return true;
    return false; 
  }
}

// Reference counted cache of UDP datagram sockets.
var endPoints = {};

// Create a new UDP datagram socket from the user specified port and address.

// TODO: IP version.
function createEndPoint (local) {
  var endPoint = new EndPoint(local), local = endPoint.local;
  if (!endPoints[local.port]) endPoints[local.port] = {};
  return endPoints[local.port][local.address] = endPoint;
}

// Look up an UDP datagram socket in the cache of bound UDP datagram sockets by
// the user specified port and address. 

// 
function lookupEndPoint (local) {
  // No interfaces bound by the desired port. Note that this would also work for
  // zero, which indicates an ephemeral binding, but we check for that case
  // explicitly before calling this function.
  if (!endPoints[local.port]) return null;

  // Read datagram socket from cache.
  var endPoint = endPoints[local.port][local.address];

  // If no datagram exists, ensure that we'll be able to create one. This only
  // inspects ports that have been bound by UDT, not by other protocols, so
  // there is still an opportuntity for error when the UDP bind is invoked.
  if (!endPoint) {
    if (endPoints[local.port][0]) {
      throw new Error('Already bound to all interfaces.');
    }
    if (local.address == 0) {
      throw new Error('Cannot bind to all interfaces because some interfaces are already bound.');
    }
  }

  // Return cached datagram socket or nothing.
  return endPoint;
}

function validator (ee) {
  return function (forward) { return check(ee, forward) }
}

function check (ee, forward) {
  return function (error) {
    if (error) {
      process.nextTick(function () {
        ee.emit('error', error);
        ee._destroy();
      });
    } else {
      try {
        forward.apply(null, __slice.call(arguments, 1));
      } catch (error) {
        ee.emit('error', error);
      }
    }
  }
}

Socket.prototype.connect = function (options) {
  // Convert legacy 'net' module parameters to an options object.
  if (typeof options != 'object') {
    var args = net._normalizeConnectArgs(arguments);
    return Socket.prototype.connect.apply(this, args);
  }

  var socket = this;

  // TODO: _endPoint.
  if (socket._dgram) throw new Error('Already connected');

  var peer = { address: options.host, port: options.port };
  var local = { address: options.localAddress, port: options.localPort };

  if (options.path) throw new Error('UNIX domain sockets are not supported.');
  if (!options.port) throw new Error('Remote port is required.');

  // Assign reasonable defaults for unspecified connection properties.
  if (!peer.address) peer.address = '127.0.0.1';
  if (!local.address) local.address = '0.0.0.0';
  if (!local.port) local.port = 0;

  if (typeof arguments[1] == 'function') {
    socket.on('connect', arguments[1]);
  }

  socket._connecting = true;

  var valid = validator(socket);

  // Resolve DNS now to use the ip as cache key. Lookup handles a interprets
  // local address as 0.0.0.0.
  dns.lookup(local.address, valid(localResolved));

  function localResolved (ip, addressType) {
    local.address = ip;

    // Use an existing datagram socket if one exists.
    if (local.port == 0) {
      socket._endPoint = createEndPoint(local);
    } else if (!(socket._endPoint = lookupEndPoint(local))) {
      socket._endPoint = createEndPoint(local);
    }

    dns.lookup(options.address, valid(peerResolved));
  }

  // Record the DNS resolved IP address.
  function peerResolved (ip, addressType) {
    // Possible cancelation during DNS lookup.
    if (!socket._connecting) return;

    socket._peer = { address: ip || '127.0.0.1', port: options.port };

    // Generate random bytes used to set randomized socket properties.
    // `crypto.randomBytes` calls OpenSSL `RAND_bytes` to generate the bytes.
    //
    //  * [RAND_bytes](http://www.openssl.org/docs/crypto/RAND_bytes.html).
    //  * [node_crypto.cc](https://github.com/joyent/node/blob/v0.8/src/node_crypto.cc#L4517)
    crypto.randomBytes(4, valid(randomzied));
  }

  // Initialize the randomized socket properies.
  function randomzied (buffer) {
    // Randomly generated randomness.
    socket._sequence = buffer.readUInt32BE(0) % MAX_SEQ_NO;

    // The end point sends a packet on our behalf.
    socket._endPoint.shakeHands(socket);
  }
}
Socket.prototype.destroy = function () {
  this._endPoint.shutdown(this);
}
Socket.prototype._destroy = Socket.prototype.destroy;

function Server () {
  if (!(this instanceof Server)) return new Server(arguments[0], arguments[1]);

  events.EventEmitter.call(this);

  var server = this;

  var options;

  if (typeof arguments[0] == 'function') {
    options = {};
    server.on('connection', arguments[0]);
  } else {
    options = arguments[0] || {};
    if (typeof arguments[1] == 'function') {
      server.on('connection', arguments[1]);
    }
  }

  // The Node.js `net` module uses a property for connections because the
  // connections property is disabled if the server is running in a
  // multi-process model, if it has "slaves." UDT does not support multi-process
  // model, so connections is plain-old property.

  //
  this.connections = 0;
}
util.inherits(Server, events.EventEmitter);
exports.Server = Server;

// TODO: Consolidate.
function selectEndPoint (local) {
  var endPoint;
  // Use an existing datagram socket if one exists.
  if (local.port == 0) {
    endPoint = createEndPoint(local);
  } else if (!(endPoint = lookupEndPoint(local))) {
    endPoint = createEndPoint(local);
  }
  return endPoint;
}

Server.prototype.listen = function () {
  var server = this;

  var lastArg = arguments[arguments.length - 1];
  if (typeof lastArg == 'function') {
    server.once('listening', lastArg);
  }

  var valid = validator(server);

  var options = { port: arguments[0] || 0 };
  dns.lookup(arguments[1], valid(resolved));

  function resolved (ip, addressType) {
    options.address = ip || '0.0.0.0';

    var endPoint = server._endPoint = selectEndPoint(options);

    if (endPoint.server) {
      throw new Error('already bound to UDT server');
    }

    endPoint.server = server;
    console.log(endPoint.local);

    process.nextTick(function () {
      server.emit('listening');
    });
  }
}

Server.prototype.close = function (callback) {
  var server = this, endPoint = server._endPoint;

  if (callback) server.once('close', callback);

  server._closing = true;

  if (endPoint.listeners == 0) {
    endPoint._server = null; 
    server.emit('close');
  }
}

const SYN_COOKIE_SALT = crypto.randomBytes(64).toString('binary');
function synCookie (address, timestamp) {
  var hash = crypto.createHash('sha1');
  hash.update(SYN_COOKIE_SALT + ':' + address.host + ':' + address.port + ':' + timestamp);
  return parseInt(hash.digest('hex').substring(0, 8), 16);
}

exports.createServer = function () {
  return new Server(arguments[0], arguments[1]);
}

function toArray (buffer) {
  return buffer.toString('hex').replace(/(..)/g, ':$1').replace(/(.{12})/g, '\n$1').replace(/\n:/g, '\n');
}
