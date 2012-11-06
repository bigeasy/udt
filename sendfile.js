var dgram = require('dgram')
  , socket = dgram.createSocket('udp4')
  , packet = require('packet')
  , packets = require('./packets')
  , __slice = [].slice;

const MAX_MSG_NO = 0x1FFFFFFF;

var Socket = require('./index').Socket;

function die () {
  console.log.apply(console, __slice.call(arguments, 0));
  return process.exit(1);
}

function say () { return console.log.apply(console, __slice.call(arguments, 0)) }

function extend (to, from) {
  for (var key in from) to[key] = from[key];
  return to;
}

var role = process.argv[2] ? 'client' : 'server';
socket.bind(role == 'client' ? 9001 : 9000);

function formatQuad (address) {
  var quad = [];
  for (i = 3; i >= 0; i--) {
    quad[i] = Math.floor(address / ( Math.pow(256, i) ))
    address = address % Math.pow(256, i)
  }
  return quad.join('.');
}

function parseQuad (quad) {
  var address = 0;
  quad = quad.split('.');
  for (i = 3; i >= 0; i--) {
    address = address + quad[i] * Math.pow(256, i);
  }
  return 0;
}

var parser = new packet.createParser(), serializer = packet.createSerializer();

for (var name in packets) {
  parser.packet(name, packets[name]);
  if (name == 'header') continue;
  serializer.packet(name, packets.header + ',' + packets[name]);
}

var got;
socket.on('message', function (buffer, remote) {
  got = buffer;
  parser.extract('header', receive);
  parser.parse(buffer);
});

var buffer = new Buffer(8192);

if (process.argv[2]) clientStart();

function clientStart () {
  var handshake =
  { control: 1
  , type: 0
  , additional: 0
  , timestamp: 0
  , destination: 0
  , version: 4
  , socketType: 1
  , sequence: 1582673141
  , maxPacketSize: 1500
  , windowSize: 8192
  , connectionType: 1
  , socketId: 13
  , synCookie: 0
  , address: 16777343
  };
  serializer.serialize('handshake', handshake);
  serializer.write(buffer);
  socket.send(buffer, 0, serializer.length, 9293, '127.0.0.1');
}

var controlTypes = 'handshake'.split(/\s+/);

function receive (header) {
  if (header.control) {
    if (!controlTypes[header.type]) throw new Error("bogotronic");
    parser.extract(controlTypes[header.type], receptionist[role][header.type](header)); 
  }
}

var receptionist = { client: [] };

receptionist.client.push(function (header) { return function (handshake) {
  switch (handshake.connectionType) {
  case -1:
    die('here', header, handshake);
    break;
  case 1:
    handshake = extend(handshake, header);
    handshake.connectionType = -1;
    handshake.destination = 0;

    serializer.reset();
    serializer.serialize('handshake', handshake);
    serializer.write(buffer);

    socket.send(buffer, 0, serializer.length, 9293, '127.0.0.1');
    break;
  default:
    throw new Error("badtastic");
  }
}});

function toArray (buffer) {
  return buffer.toString('hex').replace(/(..)/g, ':$1').replace(/(.{12})/g, '\n$1').replace(/\n:/g, '\n');
}
