// listen for other peer connections

const EventEmitter = require('events').EventEmitter;
const MessageEmitter = require('./message/emitter');
const callbackify = require('util').callbackify;
const checkPort = require('./check-port');
const getPort = callbackify(require('get-port'));
const natpmp = require('nat-pmp');
const net = require('net');
const network = require('network');

class PeerServer extends EventEmitter {
    constructor(args) {
        super();

        this.port = args.port || 2234;
        this.maxPeers = args.maxPeers || 100;

        this.server = new net.Server();
        this.retries = 0;
        this.pmp = {};
        this.listening = false;
        this.peers = {};

        this.server.on('close', () => this.listening = false);

        this.server.on('listening', () => {
            console.log('peer server is listening on port ' + this.port);
            this.listening = true;
        });

        this.server.on('connection', peer => {
            console.log('new peer connected to us');

            let messages = new MessageEmitter();

            peer.on('data', data => {
                console.log('got peer data!');
                messages.write(data);
            });
        });

        this.server.on('error', err => {
            this.emit('error', err);
        });
    }

    natPmpMap(done) {
        network.get_gateway_ip((err, gateway) => {
            if (err) {
                this.emit('error', err);
                return done(err);
            }

            let natpmpClient = natpmp.connect(gateway);
            let natpmpTimeout = setTimeout(() => {
                let err = new Error(
                    'unable to connect to nat-pmp. try enabling upnp or ' +
                    `forward port ${this.port} at http://${gateway}`
                );
                this.emit('error', err);
                done(err);
            }, 5000);

            natpmpClient.portMapping({
                private: this.port,
                public: this.port,
                ttl: 3600
            }, (err, res) => {
                clearTimeout(natpmpTimeout);

                if (err) {
                    this.emit('error', err);
                    return done(err);
                }

                this.pmp = res;
                this.emit('waitPort', this.pmp.public);

                this.server.listen(this.pmp.private, () => {
                    checkPort(this.port, (err, open) => {
                        if (err) {
                            return done(err);
                        }

                        if (!open) {
                            let err = new Error('we used pmp but soulseek ' +
                                'still can\'t see us');
                            this.emit('error', err);
                            return done(err);
                        }

                        done();
                    });
                });
            });
        });
    }

    init(done) {
        getPort(this.port, (err, port) => {
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
                        return done(err);
                    }

                    if (!open) {
                        this.server.close();
                        this.natPmpMap(done);
                        return;
                    }

                    done();
                });
            });
        });
    }
}

module.exports = PeerServer;
