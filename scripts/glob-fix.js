// Preload patch: skip locked temp directory during build glob scanning
const fs = require('fs');
const blocked = 'UTLB7F9.tmp.dir';

const origReaddir = fs.readdir;
fs.readdir = function(path, ...args) {
  if (path && path.toString().includes(blocked)) {
    const cb = args[args.length - 1];
    if (typeof cb === 'function') { return cb(null, []); }
  }
  return origReaddir.call(this, path, ...args);
};

const origReaddirSync = fs.readdirSync;
fs.readdirSync = function(path, ...args) {
  if (path && path.toString().includes(blocked)) { return []; }
  return origReaddirSync.call(this, path, ...args);
};

const origScandir = fs.scandir;
if (origScandir) {
  fs.scandir = function(path, ...args) {
    if (path && path.toString().includes(blocked)) {
      const cb = args[args.length - 1];
      if (typeof cb === 'function') { return cb(null, []); }
    }
    return origScandir.call(this, path, ...args);
  };
}

const origOpendirSync = fs.opendirSync;
if (origOpendirSync) {
  fs.opendirSync = function(path, ...args) {
    if (path && path.toString().includes(blocked)) {
      throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    }
    return origOpendirSync.call(this, path, ...args);
  };
}
