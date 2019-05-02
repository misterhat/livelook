// connect to a soulseek server

const SoulSock = require('../soul-sock');
const fromServer = require('../message/from-server');
const toServer = require('../message/to-server');

class Client extends SoulSock {
    constructor(address) {
        super(address);
        this.encoder = toServer;
        this.decoder = fromServer;
    }
}

module.exports = Client;
