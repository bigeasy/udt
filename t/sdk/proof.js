var path = require('path'), spawn = require('child_process').spawn;

function extend (to, from) {
  for (var key in from) to[key] = from[key];
  return to;
}

function execute (program, parameters) {
  var paths = {
    program: path.join(__dirname, '/../../sdk/', program),
    library: path.join(__dirname, '/../../build/udt4/src')
  };
  var env = extend(extend({}, process.env), {
    DYLD_LIBRARY_PATH: paths.library,
    LD_LIBRARY_PATH: paths.library
  });
  return spawn(paths.program, parameters, { env: env });
}

module.exports = require('proof')(function () {
  return { execute: execute, proxy: require('../../proxy').proxy }; 
});
