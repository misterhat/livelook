// peers with cType F

const EventEmitter = require('events').EventEmitter;
const net = require('net');
const toPeer = require('../message/to-peer');
const Uint64LE = require('int64-buffer').Uint64LE;
const makeToken = require('../make-token');
const attachHandlers = require('./handlers');

class TransferPeer extends EventEmitter {
    constructor(args) {
        super();

        this.username = args.username; // TODO may not need
        this.ip = args.ip;
        this.port = args.port;

        if (typeof args.isUpload === 'undefined') {
            this.isUpload = true;
        } else {
            this.isUpload = !!args.isUpload;
        }

        if (!args.token) {
            this.token = makeToken();
        } else {
            this.token = args.token;
        }

        this.socket = new net.Socket();
        this.connected = false;

        this.socket.on('close', () => {
            this.connected = false;
            this.emit('close');
        });

        if (this.isUpload) {
            this.incomingData = Buffer.alloc(0);
            this.fileToken = null;
            this.fileStart = null;

            this.socket.on('data', data => {
                // this shouldn't happen
                if (this.fileToken && this.fileStart) {
                    return;
                }

                this.incomingData = Buffer.concat([this.incomingData, data]);

                if (!this.fileToken && this.incomingData.length >= 4) {
                    this.fileToken = this.incomingData.readUInt32LE(0);
                    this.incomingData = this.incomingData.slice(4);
                }

                if (!this.fileStart && this.incomingData.length >= 8) {
                    this.fileStart = new Uint64LE(this.incomingData, 0).toNumber();
                    this.incomingData = this.incomingData.slice(8);
                    this.emit('fileToken', this.fileToken, this.fileStart);
                }
            });
        } else {
            this.bytesDownloaded = 0;

            this.socket.on('data', data => {
                this.bytesDownloaded += data.length;

                if (this.bytesDownloaded >= this.fileSize) {
                    this.socket.end();
                } else {
                    this.emit('fileData', data);
                }
            });
        }

        this.socket.on('error', err => this.emit('error', err));
    }

    attachHandlers(livelook) {
        attachHandlers(livelook, this);
    }

    pierceFirewall() {
        this.socket.write(toPeer.pierceFirewall(this.token).getBuff());
    }

    peerInit(username) {
        this.socket.write(toPeer.peerInit(username, 'F', this.token).getBuff());
    }

    sendFileToken() {
        let buff = Buffer.alloc(4);
        buff.writeInt32LE(this.fileToken);
        this.socket.write(buff);
    }

    sendFileStart() {
        this.socket.write(new Uint64LE(this.fileStart).toBuffer());
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
