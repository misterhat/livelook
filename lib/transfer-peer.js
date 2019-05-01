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

        // this will be receiving a pierce or raw upload data
        // I THINK they send us the token after we're done
        this.socket.on('data', data => {
            console.log('TRANSFER PEER GOT ', data);
        });

        this.socket.on('error', err => this.emit('error', err));
    }

    // upload a stream
    uploadFile(file) {

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
