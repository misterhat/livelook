const crypto = require('crypto');
//module.exports = () => crypto.randomBytes(4).toString('hex');
module.exports = () => crypto.randomBytes(4).readUInt32LE(0);
