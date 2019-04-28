const EventEmitter = require('events').EventEmitter;
const net = require('net');
const uploadSpeed = require('./lib/upload-speed');

class LiveLook extends EventEmitter {
    constructor(args) {
        this.username = args.username;
        this.password = args.password;

        this.shares = args.shares;
        this.shareList = {};

        // cache gzipped search results (?) and our shares
        this.cache = {};

        this.server = net.Server();
    }

    refreshUploadSpeed() {
        uploadSpeed((err, speed) => {
            if (err) {
                this.emit('error', err);
            }

            this.uploadSpeed = speed;
            this.emit('upload-speed', speed);
        });
    }

    refreshShareList() {

    }

    init() {
        refreshUploadSpeed();
    }

    login() {
    }
}

module.exports.connect = function (args, done) {
    let livelook = new LiveLook(args);
    livelook.connect(done);
};
