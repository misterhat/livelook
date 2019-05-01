const EventEmitter = require('events').EventEmitter;
const MessageEmitter = require('./message/emitter');
const fromPeer = require('./message/from-peer');
const toPeer = require('./message/to-peer');
const net = require('net');

// TODO this and client are basically the same. make a base class

class Peer extends EventEmitter {
    constructor(args) {
        super();

        this.username = args.username;
        this.ip = args.ip.join('.');
        this.port = args.port;
        this.token = args.token;

        this.socket = new net.Socket();
        this.messages = new MessageEmitter();
        this.connected = false;

        this.socket.on('close', () => {
            this.connected = false;
            this.emit('close');
        });
        this.socket.on('error', err => this.emit('error', err));

        this.messages.on('message', message => {
            let size = message.int32();

            if (size < 4) {
                return;
            }

            if (message.length === 12) {
                console.log('this may be the spooky weird message we can ignore');
            }

            let code = message.int32();
            let decoded = fromPeer[code];

            try {
                decoded = decoded ? decoded(message) : null;
            } catch (e) {
                e.packet = message;
                this.emit('error', e);
            }

            if (!decoded) {
                let err = new Error(`unknown message id ${code}`);
                err.packet = message;
                this.emit('error', err);
            } else {
                console.log('from peer', JSON.stringify(decoded));
                this.emit(decoded.type, decoded);
            }
        });

        this.socket.on('data', data => this.messages.write(data));
    }

    sendMessage(message) {
        if (this.connected) {
            this.socket.write(message.getBuff());
        }
    }

    send(type, ...args) {
        let factory = toPeer[type];

        if (!factory) {
            throw new Error(`no message factory for ${type}`);
        }

        this.sendMessage(factory.apply(null, args));
    }

    init(done) {
        this.socket.connect({
            host: this.ip,
            port: this.port
        }, () => {
            this.connected = true;
            this.emit('connect');

            if (done) {
                done();
            }
        });
    }
}

module.exports = Peer;
