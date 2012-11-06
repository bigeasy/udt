var dgram = require('dgram')
  , socket = dgram.createSocket('udp4')
  , packet = require('packet')
  , common = require('./common')
  , crypto = require('crypto')
  , Heap = require('./heap').Heap
  , __slice = [].slice;

const CONTROL_TYPES = 'handshake'.split(/\s+/);
const MAX_MSG_NO = 0x1FFFFFFF;
const MAX_SEQ_NO = Math.pow(2, 31) - 1;

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
function EndPoint (options) {
  this.references = 1;
  this.dgram = dgram.createSocket('udp4');
  this.dgram.on('message', EndPoint.prototype.receive.bind(this));
  this.dgram.bind(options.localPort, options.localAddress);
  var address = this.dgram.address();
  this.localPort = address.port;
  this.localAddress = options.localAddress;
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
  , address: parseDotDecimal(socket._peer.host)
  });
}
EndPoint.prototype.shutdown = function (socket) {
  // Remove the socket from the stash.
  delete this.sockets[socket._socketId];

  // Zero the status.
  delete socket._status;

  var serializer = common.serializer,
      packet = this.packet, dgram = this.dgram,
      count = 0, peer = socket._peer;

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

  var callback = function () {};

  // Dispose of the end point and UDP socket if it is no longer referenced.
  if (--this.references == 0) {
    var address = this.dgram.address();
    delete endPoints[this.localPort][this.localAddress];
    if (Object.keys(endPoints[this.localPort]).length == 0) {
      delete endPoints[this.localPort];
    }
    callback = function () { dgram.close() };
  }

  dgram.send(packet, 0, serializer.length, peer.port, peer.host, callback);
}
// Send the handshake four times a second until we get a response, or until four
// seconds is up.
EndPoint.prototype.sendHandshake = function (socket, handshake) {
  var serializer = common.serializer,
      packet = this.packet, dgram = this.dgram,
      count = 0, peer = socket._peer;
  socket._handshakeInterval = setInterval(function () {
    if (++count == 12) {
      clearInterval(socket._handshakeInterval);
      socket.emit('error', new Error('connection timeout'));
    } else {
      serializer.reset();
      serializer.serialize('handshake', handshake);
      serializer.write(packet);

      dgram.send(packet, 0, serializer.length, peer.port, peer.host);
    }
  }, 250);
}
EndPoint.prototype.receive = function (msg, rinfo) {
  var endPoint = this, parser = common.parser, handler;
  parser.extract('header', function (header) {
    if (header.control) {
      // TODO: Socket not found...
      var socket = endPoint.sockets[header.destination];
      switch (header.type) {
      case 0x1:
        // Keep-alive.
        break;
      case 0x5:
        // Shutdown.
        break;
      case 0x6:
        // Notifications from Bill the Cat. (Ack-ack.)
        break;
      default:
        var name = CONTROL_TYPES[header.type];
        parser.extract(name, endPoint[name].bind(endPoint, socket, header))
      }
    } else {
    }
  });
  parser.parse(msg);
}
EndPoint.prototype.handshake = function (socket, header, handshake) {
  switch (socket._status) {
  case "syn":
    // Only respond to an initial handshake.
    if (handshake.connectionType != 1) break;

    clearInterval(socket._handshakeInterval);

    socket._status = "syn-ack";

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
  case "syn-ack":
    // Only respond to an follow-up handshake.
    if (handshake.connectionType != -1) break;

    clearInterval(socket._handshakeInterval);

    socket._status = "connected";
    socket._peer.socketId = handshake.socketId;

    socket.emit('connect');
    break;
  }
}

// Reference counted cache of UDP datagram sockets.
var endPoints = {};

// Create a new UDP datagram socket from the user specified port and address.

// 
function createEndPoint (options) {
  var endPoint = new EndPoint(options), address = endPoint.dgram.address();
  if (!endPoints[endPoint.localPort]) endPoints[endPoint.localPort] = {};
  return endPoints[endPoint.localPort][endPoint.localAddress] = endPoint;
}

// Look up an UDP datagram socket in the cache of bound UDP datagram sockets by
// the user specified port and address. 

// 
function lookupEndPoint (options) {
  // No interfaces bound by the desired port. Note that this would also work for
  // zero, which indicates an ephemeral binding, but we check for that case
  // explicitly before calling this function.
  if (!endPoints[options.localPort]) return null;

  // Read datagram socket from cache.
  var endPoint = endPoints[options.localPort][options.localAddress];

  // If no datagram exists, ensure that we'll be able to create one. This only
  // inspects ports that have been bound by UDT, not by other protocols, so
  // there is still an opportuntity for error when the UDP bind is invoked.
  if (!endPoint) {
    if (endPoints[options.localPort][0]) {
      throw new Error('Already bound to all interfaces.');
    }
    if (options.localAddress == 0) {
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

  if (socket._dgram) throw new Error('Already connected');

  socket._options = options = extend({}, options);

  if (options.path) throw new Error('UNIX domain sockets are not supported.');
  if (!options.port) throw new Error('Remote port is required.');

  // Assign reasonable defaults for unspecified connection properties.
  if (!options.host) options.host = '127.0.0.1';
  if (!options.localAddress) options.localAddress = 0;
  if (!options.localPort) options.localPort = 0;

  // Convert local address to a 32 bit integer.
  if (typeof options.localAddress == 'string') {
    options.localAddress = parseDotDecimal(options.localAddress);
  }

  // Use an existing datagram socket if one exists.
  if (options.localPort == 0) {
    socket._endPoint = createEndPoint(options);
  } else if (!(socket._endPoint = lookupEndPoint(options))) {
    socket._endPoint = createEndPoint(options);
  }

  socket._connecting = true;

  var valid = validator(socket);

  require('dns').lookup(options.host, valid(resolved));

  // Record the DNS resolved IP address.
  function resolved (ip, addressType) {
    // Possible cancelation during DNS lookup.
    if (!socket._connecting) return;

    socket._peer = { host: ip || '127.0.0.1', port: options.port };

    // Generate random bytes used to set randomized socket properties.
    // `crypto.randomBytes` calls OpenSSL `RAND_bytes` to generate the bytes.
    //
    //  * [RAND_bytes](http://www.openssl.org/docs/crypto/RAND_bytes.html).
    //  * [node_crypto.cc](https://github.com/joyent/node/blob/v0.8/src/node_crypto.cc#L4517)
    crypto.randomBytes(8, valid(randomzied));
  }

  // Initialize the randomized socket properies.
  function randomzied (buffer) {
    // Randomly generated randomness.
    socket._sequence = buffer.readUInt32BE(0) % MAX_SEQ_NO;
    socket._socketId = buffer.readUInt32BE(4);

    // The end point sends a packet on our behalf.
    socket._endPoint.shakeHands(socket);
  }
}
Socket.prototype.destroy = function () {
  this._endPoint.shutdown(this);
}
Socket.prototype._destroy = Socket.prototype.destroy;

function toArray (buffer) {
  return buffer.toString('hex').replace(/(..)/g, ':$1').replace(/(.{12})/g, '\n$1').replace(/\n:/g, '\n');
}
