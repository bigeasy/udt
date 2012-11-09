var udt = require('./index');

function shutdown () {
  server.close(function () {
    console.log('closed');
  });
}

var server = new udt.createServer(function (socket) {
  console.log('connected');
  //setTimeout(shutdown, 1000);
  shutdown();
});

server.listen(9000, '127.0.0.1', function () { console.log('listening') });
