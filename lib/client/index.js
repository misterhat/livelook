// connect to a soulseek server

const EventEmitter = require('events').EventEmitter;
const MessageEmitter = require('../message/emitter');
const fromServer = require('../message/from-server');
const net = require('net');
const toServer = require('../message/to-server');

class Client extends EventEmitter {
    constructor(address) {
        super();

        this.address = address;

        this.socket = new net.Socket();
        this.messages = new MessageEmitter();
        this.connected = false;

        this.socket.on('close', () => {
            this.connected = false;
            this.emit('disconnect');
        });
        this.socket.on('error', err => this.emit('error', err));

        this.messages.on('message', message => {
            let size = message.int32();

            if (size < 4) {
                return;
            }

            let code = message.int32();
            let decoded = fromServer[code];

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
                console.log('from slsk', JSON.stringify(decoded));
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
        let factory = toServer[type];

        if (!factory) {
            throw new Error(`no message factory for ${type}`);
        }

        this.sendMessage(factory.apply(null, args));
    }

    init(done) {
        this.socket.connect(this.address, () => {
            this.connected = true;
            this.emit('connect');
            if (done) {
                done();
            }
        });
    }
}

module.exports = Client;
