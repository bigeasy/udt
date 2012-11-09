#!/usr/bin/env node

require('proof')(1, function (async, ok) {
  var udt = require('../..');

  var server = udt.createServer(), first, second;
  async(function () {
    server.listen(9000, '127.0.0.1', async());
  }, function () {
    first = new udt.Socket;
    first.connect(9000, '127.0.0.1', async());
  }, function () {
    server.close();

    var second = new udt.Socket;
    second.connect(9000, '127.0.0.1');

    second.on('error', async());
  }, function (error) {
    ok(1, 'timeout')
    first.destroy();
  });
});
