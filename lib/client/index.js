// connect to a soulseek server

const SoulSock = require('../soul-sock');
const fromServer = require('../message/from-server');
const toServer = require('../message/to-server');
const attachHandlers = require('./handlers');

class Client extends SoulSock {
    constructor(address) {
        super(address);
        this.encoder = toServer;
        this.decoder = fromServer;
    }

    attachHandlers(livelook) {
        attachHandlers(livelook, this);
    }
}

module.exports = Client;
