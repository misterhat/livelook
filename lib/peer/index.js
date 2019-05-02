// a direct connection to another user

const SoulSock = require('../soul-sock');
const fromPeer = require('../message/from-peer');
const toPeer = require('../message/to-peer');

class Peer extends SoulSock {
    constructor(args) {
        super(args);
        this.encoder = toPeer;
        this.decoder = fromPeer;

        this.username = args.username;
        this.token = args.token;
    }
}

module.exports = Peer;
