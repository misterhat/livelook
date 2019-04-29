const EventEmitter = require('events').EventEmitter;
const uploadSpeed = require('./lib/upload-speed');
const Client = require('./lib/client');

class LiveLook extends EventEmitter {
    constructor(args) {
        super();

        this.username = args.username;
        this.password = args.password;
        this.server = args.server || 'server.slsknet.org';
        this.port = args.port || 2242;
        this.waitPort = args.waitPort || 2234;
        this.sharedFolders = args.sharedFolders;

        this.shareList = {};

        // cache gzipped search results (?) and our shares
        this.cache = {};

        // the connection to soulseek's server
        this.client = new Client({ host: this.server, port: this.port });
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

    init(done) {
        this.refreshUploadSpeed();

        let loginTimeout = setTimeout(() => {
            done(new Error('timed out'));
        }, 5000);

        this.client.init(() => {
            this.login();
        });

        this.client.once('login', res => {
            clearTimeout(loginTimeout);

            if (res.success) {
                done();
            } else {
                done(new Error(res.reason));
            }
        });
    }

    setWaitPort(port) {
        if (port) {
            this.port = port;
        }

        this.client.setWaitPort(this.port);
    }

    login(username, password) {
        if (username) {
            this.username = username;
        }

        if (password) {
            this.password = password;
        }

        this.client.login(this.username, this.password);
        this.setWaitPort();
    }
}

module.exports = LiveLook;
