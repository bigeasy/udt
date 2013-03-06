var dgram = require('dgram'),
    packet = require('packet'),
    __slice = [].slice;


var client = dgram.createSocket('udp4'),
    server = dgram.createSocket('udp4'),
    info;

function die () {
  console.log.apply(console, __slice.call(arguments, 0));
  process.exit(1);
}

function say () { console.log.apply(console, __slice.call(arguments, 0)) }

function extend (to, from) {
  for (var key in from) to[key] = from[key];
  return to;
}

function proxy (input, output, remote, interceptor) {
  if (!interceptor) interceptor = function () {}

  var types = "Handshake Keep-alive Acknowledgement Negative-acknowledgement \
    Unused Shutdown Acknowledgement-acknowledgement Drop".split(/\s+/);

  var parser = packet.createParser();
  var packets = require('./common').packets;

  parser.packet('header', packets.header);
  parser.packet('handshake', packets.handshake);

  client.bind(input, '127.0.0.1');
  server.bind(output, '127.0.0.1');

  client.on('message', function (buffer, $info) {
    info = $info;
    log('Client', buffer, function (buffer) {
      server.send(buffer, 0, buffer.length, remote, '127.0.0.1');
    });
  });

  var epoch = process.hrtime();
  function log (participant, buffer, callback) {
    parser.reset();
    parser.extract('header', function (header) {
      epoch = process.hrtime();
      if (header.control) {
        console.log(participant + ': Control ' + types[header.type], header);
        switch (header.type) {
        case 0:
          parser.extract('handshake', function (handshake) {
            console.log(handshake);
            callback(buffer);
          })
          break;

        default:
          callback(buffer);
        }
      } else {
        console.log(participant + ': Data');
        console.log(extend(header, { parser: parser.length, buffer: buffer.length }));
        if (participant == 'Client' && buffer.length - parser.length == 4) {
          callback(buffer);
        } else {
          console.log(toArray(buffer));
          callback(buffer);
        }
      }
    });
    parser.parse(buffer);
  }

  function toArray (buffer) {
    return buffer.toString('hex').replace(/(..)/g, ':$1')
                                 .replace(/(.{12})/g, '\n$1')
                                 .replace(/\n:/g, '\n');
  }

  server.on('message', function (buffer) {
    log('Server', buffer, function (buffer) {
      client.send(buffer, 0, buffer.length, info.port, '127.0.0.1');
    });
  });
}

if (!module.parent) {
  proxy(9293, 9593, 9000, function (buffer) { return buffer });
} else {
  exports.proxy = proxy;
}
