const dns = require('dns');
const origLookup = dns.lookup;

const IP_MAP = {
  'registry.npmjs.org': '104.16.11.34',
  'nodejs.org': '104.20.22.46',
  'registry.yarnpkg.com': '104.16.11.34'
};

dns.lookup = function(hostname, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  if (hostname && (IP_MAP[hostname] || hostname.includes('npmjs'))) {
    const ip = IP_MAP[hostname] || '104.16.11.34';
    if (options && options.all) {
      return callback(null, [{ address: ip, family: 4 }]);
    }
    return callback(null, ip, 4);
  }
  return origLookup.call(this, hostname, options, callback);
};
