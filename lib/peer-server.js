// listen for other peer connections

const EventEmitter = require('events').EventEmitter;
const Message = require('./message');
const MessageEmitter = require('./message/emitter');
const Peer = require('./peer');
const callbackify = require('util').callbackify;
const checkPort = require('./check-port');
const fromPeer = require('./message/from-peer');
const getPort = callbackify(require('get-port'));
const natPmpMap = require('./nat-pmp-map');
const net = require('net');

class PeerServer extends EventEmitter {
    constructor(args, livelook) {
        super();

        this.port = args.port || 2234;
        this.maxPeers = args.maxPeers || 100;
        this.livelook = livelook; // :(

        this.server = new net.Server();
        this.pmp = {};
        this.listening = false;
        //this.peers = {};

        this.server.on('close', () => {
            this.emit('close');
            this.listening = false;
        });

        this.server.on('listening', () => {
            console.log('peer server is listening on port ' + this.port);
            this.emit('listening');
            this.listening = true;
        });

        this.incomingData = Buffer.alloc(0);

        this.server.on('connection', socket => {
            // TODO check for banned IPs

            let errorListener = err => this.emit('error', err);
            socket.on('error', errorListener);

            let length;

            let dataListener = data => {
                this.incomingData = Buffer.concat([this.incomingData, data]);
                console.log(this.incomingData);

                if (!length && this.incomingData.length >= 4) {
                    length = this.incomingData.readUInt32LE(0);
                    this.incomingData = this.incomingData.slice(4);
                }

                if (this.incomingData.length >= length) {
                    let id = this.incomingData[0];
                    console.log('peer server client id', id);
                    let message = new Message(this.incomingData.slice(1));
                    let decoded = fromPeer[id](message);

                    if (decoded.type === 'pierceFirewall') {
                        console.log('peer server client sent us a pierce firewall');
                    } else if (decoded.type === 'peerInit') {
                        if (decoded.cType === 'F') {
                            // TODO TransferPeer
                            console.log('TODO bring TransferPeer');
                            return;
                        }

                        let peer = new Peer(socket);
                        peer.connected = true;
                        peer.token = decoded.token;
                        peer.attachHandlers(this.livelook);

                        // remove old event listeners because peer has its own
                        socket.removeListener('data', dataListener);
                        socket.removeListener('error', errorListener);

                        peer.init(() => {
                            peer.pierceFirewall();
                            // the next message is usually stuck to the initial
                            // buffer, so we can re-send it to make sure our
                            // message emitter reads it
                            let nextData = this.incomingData.slice(length);
                            peer.socket.emit('data', nextData);
                        });
                    }
                }
            };

            socket.on('data', dataListener);
        });

        this.server.on('error', err => this.emit('error', err));
    }

    natPmpMap(done) {
        natPmpMap.bind(this)((err, res) => {
            if (err) {
                this.emit('error', err);
                return done(err);
            }

            this.server.listen(this.pmp.private, () => {
                checkPort(this.port, (err, open) => {
                    if (err) {
                        done(err);
                        this.emit('error', err);
                    } else if (!open) {
                        let err = new Error('we used pmp but soulseek ' +
                            'still can\'t see us');
                        this.emit('error', err);
                        done(err);
                    } else {
                        done();
                    }
                });
            });
        });
    }

    init(done) {
        getPort({ port: this.port }, (err, port) => {
            if (err) {
                this.emit('error', err);
                return done(err);
            }

            this.port = port;
            this.emit('waitPort', this.port);

            let listenTimeout = setTimeout(() => {
                let err = new Error('timed out with peer server listen');
                this.emit('error', err);
                done(err);
            }, 5000);

            this.server.listen(this.port, () => {
                clearTimeout(listenTimeout);

                checkPort(this.port, (err, open) => {
                    if (err) {
                        done(err);
                    } else if (!open) {
                        this.server.close();
                        this.natPmpMap(done);
                    } else {
                        done();
                    }
                });
            });
        });
    }
}

module.exports = PeerServer;
