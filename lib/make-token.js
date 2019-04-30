const crypto = require('crypto');
module.exports = () => crypto.randomBytes(4).toString('hex');
