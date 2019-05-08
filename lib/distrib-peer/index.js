const EventEmitter = require('events').EventEmitter;
const MessageEmitter = require('../message/emitter');
const attachHandlers = require('./handlers');
const fromDistrib = require('../message/from-distrib');
const net = require('net');
const toDistrib = require('../message/to-distrib');

// TODO make soulsock a little more generic and extend that

class DistribPeer extends EventEmitter {
    constructor(args) {
        super();

        if (args.constructor && args.constructor.name === 'Socket') {
            this.socket = args;
        } else {
            this.username = args.username;
            this.ip = args.ip;
            this.port = args.port;
            this.socket = new net.Socket();
        }

        this.messages = new MessageEmitter();
        this.connected = false;

        let length;

        this.socket.on('error', err => this.emit('error', err));

        this.messages.on('message', message => {
            let size = message.int32();

            if (!size) {
                return;
            }

            let code = message.int8();

            let decoded;

            try {
                decoded = fromDistrib[code](message);
            } catch (e) {
                e.packet = message;
                this.emit('error', e);
                return;
            }

            this.emit(decoded.type, decoded);
        });
    }

    sendMessage(message) {
        if (this.connected) {
            this.socket.write(message.getBuff());
        }
    }

    send(type, ...args) {
        let factory = toDistrib[type];

        if (!factory) {
            throw new Error(`no message factory for ${type}`);
        }

        console.log(this.constructor.name, 'sending', type, JSON.stringify(args));
        this.sendMessage(factory.apply(null, args));
    }

    attachHandlers(livelook) {
        attachHandlers(livelook, this);
    }

    pierceFirewall() {
        this.send('pierceFirewall', this.token);
    }

    init(done) {
        this.socket.pipe(this.messages);

        // we're already connected
        if (this.socket.bytesRead) {
            this.emit('connect');
            done();
            return;
        }

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

module.exports = DistribPeer;
