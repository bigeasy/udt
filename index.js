var dgram = require('dgram')
  , socket = dgram.createSocket('udp4')
  , packet = require('packet')
  , __slice = [].slice;

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

var packets = {};

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

// No good place to put this yet, but it is nice that we get a full alternation
// pattern one way, but we can't get it going back. We could also extract the
// switch condition, then also skip it. `b8(&8x80 this| that) => switch`.
// Otherwise, we need to dip into that first bit unpacking, pack it, then use
// what we need to use for the test.
//
// Not sure how names were supposed work with alternation, actually.
//
// In the mean time, we can use Parser to break apart the header, but we can be
// specific about how it is ressembled. Or, we can just dip into each alternate
// and get the first option and test that using read/write. Wow. Someone was
// thinking about this.
var packets =
{ header: '\
    b8( \
      &0x80/1:  \
        b16{b1 => control, b15 => type}, x16{0} \
      , b32 => additional \
      , b32 => timestamp \
      , b32 => destination \
      | \
        b32{b1 => control, b31 => sequence} \
      , b32{b2 => position, b1 => inOrder, b29 => number} \
      , b32 => timestamp \
      , b32 => destination \
      ) \
    '
, handshake: '\
    b32 => version \
  , b32 => socketType \
  , b32 => sequence \
  , b32 => maxPacketSize \
  , b32 => windowSize \
  , -b32 => connectionType \
  , b32 => socketId \
  , b32 => synCookie \
  , b32 => address \
  , x96{0} \
  '
}

var parser = new packet.Parser(), serializer = new packet.Serializer();

for (var name in packets) {
  parser.packet(name, packets[name]);
  serializer.packet(name, packets.header + ',' + packets[name]);
}

var got;
socket.on('message', function (buffer, remote) {
  got = buffer;
  parser.extract('header', recvHeader);
  parser.parse(buffer);
});

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
  serializer.buffer('handshake', handshake, function (buffer) {
    socket.send(buffer, 0, buffer.length, 9000, '127.0.0.1');
  });
}


function recvHeader (header) {
  if (header.control) {
    switch (header.type) {
    case 0x0:
      parser.extract('handshake', dialog[role](header));
      break;
    default:
      die(header);
    }
  }
}

var dialog =
{ client: function (header) {
    return function (handshake) {
      if (count) return;
      count++;
        handshake = extend(header, handshake);
        say(extend({}, handshake));
        handshake.destination = 0;
        handshake.socketId = 13;
        handshake.connectionType = -1;
        serializer.buffer('handshake', handshake, function (buffer) {
        //  say(toArray(buffer));
        //  say(toArray(got));
          say(buffer.length);
          socket.send(buffer, 0, buffer.length, 9000, '127.0.0.1', function (e) {
            console.log('sendt');
          });
          socket.on('error', function (e) { throw e });
        });
      }
    }
, server: function (header) {
    return function (handshake) {
      handshake = extend(header, handshake);
      say('handsake', extend({}, handshake));
      if (count == 2) {
        socket.close();
      } else {
        serializer.buffer('handshake', handshake, function (buffer) {
    //      say(toArray(buffer));
    //      say(toArray(got));
          count++;
          var response =
          { control: 1
          , type: 0
          , additional: 0
          , timestamp: 0
          , destination: handshake.destination
          , version: 4
          , socketType: 1
          , sequence: 3
          , maxPacketSize: 1500
          , windowSize: 8192
          , connectionType: -1
          , socketId: 5
          , synCookie: 9
          , address: 16777343
          };
          serializer.buffer('handshake', response, function (buffer) {
            socket.send(buffer, 0, buffer.length, 9000, '127.0.0.1');
          });
        });
      }
    }
  }
}

var count = 0;

function toArray (buffer) {
  return buffer.toString('hex').replace(/(..)/g, ':$1').replace(/(.{12})/g, '\n$1').replace(/\n:/g, '\n');
}

function sendHeader (sendHandshake) {
  return function () {
    say(toArray(arguments[0]))
    say(toArray(got));
    die('here');
  }
}

function sendHandshake (handshake) {
  
}
