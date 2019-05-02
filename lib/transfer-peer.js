// peers with cType F

const EventEmitter = require('events').EventEmitter;
const net = require('net');
const toPeer = require('./message/to-peer');

class TransferPeer extends EventEmitter {
    constructor(args) {
        super();

        this.username = args.username;
        this.ip = args.ip;
        this.port = args.port;
        this.token = args.token;

        this.socket = new net.Socket();
        this.connected = false;

        this.socket.on('close', () => {
            this.connected = false;
            this.emit('close');
        });

        this.incomingData = Buffer.alloc(0);

        this.socket.on('data', data => {
            this.incomingData = Buffer.concat([this.incomingData, data]);

            if (this.incomingData.length >= 16) {
                console.log('xfer peer sent us 16');
                let ready = this.incomingData.toString('hex', 0, 16);
                if (ready === '0'.repeat(16)) {
                    console.log('we got 16 0s');
                    this.incomingData = this.incomingData.slice(-16);
                }
                /*let ready = this.incomingData.toString('hex', 0, 16);

                if (ready === '0'.repeat(16)) {
                    this.incomingData = this.incomingData.slice(-16);
                    this.emit('ready');
                    return;
                }*/
            }

            if (this.incomingData.length >= 4) {
                console.log('enough data to check for token');
                let token = this.incomingData.readUInt32LE(0);

                if (token !== 0) {
                    this.fileToken = token;
                    this.emit('token', token);
                    this.incomingData = this.incomingData.slice(-4);
                }
            }
        });

        this.socket.on('error', err => this.emit('error', err));
    }

    pierceFirewall() {
        let buff = toPeer.pierceFirewall(this.token).getBuff();
        console.log('xfer peer pierce fw buff', buff);
        this.socket.write(buff);
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

module.exports = TransferPeer;
