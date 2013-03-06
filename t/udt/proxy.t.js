#!/usr/bin/env node

require('proof')(1, function (ok) {
  ok(require(__dirname + "/../../proxy").proxy, "require");
});
