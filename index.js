const Client = require('./lib/client');
const EventEmitter = require('events').EventEmitter;
const async = require('async');
const uploadSpeed = require('./lib/upload-speed');
const buildList = require('./lib/build-list');

class LiveLook extends EventEmitter {
    constructor(args) {
        super();

        this.username = args.username;
        this.password = args.password;
        this.server = args.server || 'server.slsknet.org';
        this.port = args.port || 2242;
        this.waitPort = args.waitPort || 2234;
        this.sharedFolder = args.sharedFolder;
        this.description = args.description;

        // the share list pojo
        this.shareList = {};

        // cache gzipped search results (?) and our shares
        this.cache = {};

        // the connection to soulseek's server
        this.client = new Client({ host: this.server, port: this.port });

        // are we sucessfully logged in?
        this.loggedIn = false;
    }

    init(done) {
        async.parallel([
            done => buildList.shares(this.sharedFolder, [], done),
            done => uploadSpeed(done)
        ], (err, res) => {
            if (err) {
                return done(err);
            }

            this.shareList = res[0];
            this.uploadSpeed = res[1];

            console.log(res);

            this.client.init(done);
        });
    }

    refreshShareList() {

    }

    login(done) {
        if (!this.client.connected) {
            console.log('called login before init, initting');

            this.init((err) => {
                this.login(done);
            });

            return;
        }

        this.client.send('login', this.username, this.password);
        this.setWaitPort();

        this.client.once('login', res => {
            this.loggedIn = res.success;
            done(null, res);
        });
    }

    setWaitPort(port) {
        if (port) {
            this.port = port;
        }

        this.client.send('setWaitPort', this.port);
    }

    refreshUploadSpeed() {
        this.uploadSpeed = speed;
        this.client.send('setUploadSpeed', speed);
    }
}

module.exports = LiveLook;
