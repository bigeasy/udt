var udt = require('./index');

var socket = new udt.Socket;

socket.connect(9293);
socket.on('connect', function () {
  console.log('connected');
  var buffer = new Buffer(4);
  buffer.writeInt32LE(5, 0);
  socket.write(buffer);
});
