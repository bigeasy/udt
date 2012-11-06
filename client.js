var udt = require('./index');

var socket = new udt.Socket;

socket.connect(9293);
socket.on('connect', function () {
  console.log('connected');
  socket.destroy();
});
