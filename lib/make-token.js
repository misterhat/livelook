const crypto = require('crypto');
//module.exports = () => crypto.randomBytes(4).toString('hex');
//module.exports = () => crypto.randomBytes(4).readInt32LE(0);
module.exports = () => Math.floor(Math.random() * 2147483647);
