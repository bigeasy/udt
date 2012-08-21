var dgram   = require('dgram'),
    client  = dgram.createSocket('udp4'),
    server  = dgram.createSocket('udp4'),
    packet  = require('packet'),
    __slice = [].slice,
    info;

function die () {
  console.log.apply(console, __slice.call(arguments, 0));
  return process.exit(1);
}

function say () { return console.log.apply(console, __slice.call(arguments, 0)) }

function extend (to, from) {
  for (var key in from) to[key] = from[key];
  return to;
}

var types = "Handshake Keep-alive Acknowledgement Negative-acknowledgement \
  Unused Shutdown Acknowledgement-acknowledgement Drop".split(/\s+/);

var parser = packet.createParser();

packets = require('./packets');

parser.packet('header', packets.header);
parser.packet('handshake', packets.handshake);

client.bind(9293, '127.0.0.1');
server.bind(9593, '127.0.0.1');

client.on('message', function (buffer, $info) {
  info = $info;
  log('Client', buffer, function () { server.send(buffer, 0, buffer.length, 9000, '127.0.0.1'); });
});

function log (participant, buffer, callback) {
  parser.reset();
  parser.extract('header', function (header) {
    if (header.control) {
      console.log(participant + ': Control ' + types[header.type], header);
      switch (header.type) {
      case 0:
        parser.extract('handshake', function (handshake) {
          console.log(handshake);
          callback();
        })
        break;

      default:
        callback();
      }
    } else {
      console.log(participant + ': Data');
      console.log(extend(header, { parser: parser.length, buffer: buffer.length }));
      if (participant == 'Client' && buffer.length - parser.length == 4) {
        console.log("CLIENT %d", buffer.readInt32LE(parser.length));
        callback();
      } else {
//      console.log(toArray(buffer));
        callback();
      }
    }
  });
  parser.parse(buffer);
}

function toArray (buffer) {
  return buffer.toString('hex').replace(/(..)/g, ':$1').replace(/(.{12})/g, '\n$1').replace(/\n:/g, '\n');
}

server.on('message', function (buffer) {
  log('Server', buffer, function () { client.send(buffer, 0, buffer.length, info.port, '127.0.0.1'); });
});
