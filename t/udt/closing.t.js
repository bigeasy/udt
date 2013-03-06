#!/usr/bin/env node

require('proof')(1, function (step, ok) {
  var udt = require('../..');

  var server = udt.createServer(), first, second;
  step(function () {
    server.listen(9000, '127.0.0.1', step());
  }, function () {
    first = new udt.Socket;
    first.connect(9000, '127.0.0.1', step());
  }, function () {
    server.close();

    var second = new udt.Socket;
    second.connect(9000, '127.0.0.1');

    second.on('error', step());
  }, function (error) {
    ok(1, 'timeout')
    first.destroy();
  });
});
