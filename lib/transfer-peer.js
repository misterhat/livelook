// peers with cType F

const EventEmitter = require('events').EventEmitter;
const net = require('net');

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
                let endStream = this.incomingData.toString('hex', 0, 16);
                console.log(endStream, 'checking if end stream');
                if (endStream === '00000000') {
                    this.socket.end();
                    return;
                }
            }

            if (this.incomingData.length >= 4) {
                let token = this.incomingData.toString('hex', 0, 4);
                console.log('enough data to check for token');

                if (token !== '0000') {
                    this.fileToken = token;
                    this.emit('token', token);
                    this.incomingData = this.incomingData.slice(-4);
                }
            }
        });

        this.socket.on('error', err => this.emit('error', err));
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
