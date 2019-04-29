const Client = require('./lib/client');
const EventEmitter = require('events').EventEmitter;
const async = require('async');
const buildList = require('./lib/build-list');
const clientHandlers = require('./lib/client-handlers');
const cloneDeep = require('clone-deep');
const makeToken = require('./lib/make-token');
const uploadSpeed = require('./lib/upload-speed');

class LiveLook extends EventEmitter {
    constructor(args) {
        super();

        this.username = args.username;
        this.password = args.password;
        this.server = args.server || 'server.slsknet.org';
        this.port = args.port || 2242;
        this.waitPort = args.waitPort || 2234;
        this.sharedFolder = args.sharedFolder;
        this.status = 2;
        this.description = args.description;

        this.autojoin = args.autojoin || [];

        if (!Array.isArray(this.autojoin)) {
            this.autojoin = [ this.autojoin ];
        }

        // the share list pojo
        this.shareList = {};

        // all the users we've collected some information about
        //this.knownUsers = {};
        this.peers = {};

        // which rooms we're in
        this.rooms = {};

        // cache gzipped search results (?) and our shares
        this.cache = {};

        // the connection to soulseek's server
        this.client = new Client({ host: this.server, port: this.port });
        clientHandlers(this, this.client);

        // are we sucessfully logged in?
        this.loggedIn = false;
    }

    init(done) {
        this.refreshShareList((err) => {
            if (err) {
                return done(err);
            }

            this.client.init(done);
        });
    }

    // initialize our sharelist (object defining directories and files to share)
    // can be called before we log in or any time after to refresh
    refreshShareList(done) {
        if (!done) {
            done = forceRebuild;
        }

        buildList.shares(this.sharedFolder, (err, shareList) => {
            if (err) {
                this.emit('error', err);
                return done(err);
            }

            this.shareList = shareList;

            if (this.loggedIn) {
                this.refreshShareCount();
            }

            return done(null, shareList);
        });
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

            if (this.loggedIn) {
                this.refreshShareCount();
                this.refreshUploadSpeed();

                if (this.autojoin.length) {
                    async.each(
                        this.autojoin,
                        (room, done) => this.joinRoom(room, done),
                        err => done(err, res)
                    );
                    return;
                }
            }

            done(null, res);
        });
    }

    setWaitPort(port) {
        if (port) {
            this.port = port;
        }

        this.client.send('setWaitPort', this.port);
    }

    sayChatroom(room, message) {
        this.client.send('sayChatroom', room, message);
    }

    leaveChatroom(room) {
        this.client.send('leaveChatroom', room);
    }

    joinRoom(room, done) {
        done = done || (() => {});

        let joinTimeout = setTimeout(() => {
            let err = new Error(`timed out joining room ${room}`);
            this.emit('error', err);
            done(err);
        }, 5000);

        this.client.once('joinRoom', res => {
            clearTimeout(joinTimeout);
            done(null, res);
        });

        this.client.send('joinRoom', room);
    }

    messageUser(username, message) {
        this.client.send('messageUser', username, message);
    }

    setStatus(status) {
        if (status) {
            this.status = status;
        }

        this.client.send('setStatus', this.status);
    }

    refreshShareCount() {
        let dirs = Object.keys(this.shareList).length;
        let files = 0;

        for (let dir of Object.keys(this.shareList)) {
            files += this.shareList[dir].length;
        }

        this.client.send('sharedFoldersFiles', dirs, files);
    }

    fileSearch(query) {
        let token = makeToken();
        this.client.send('fileSearch', token, query);
    }

    userSearch(username, query) {
        let token = makeToken();
        this.client.send('userSearch', username, token, query);
    }

    refreshUploadSpeed() {
        uploadSpeed((err, speed) => {
            if (err) {
                this.emit('error', err);
            }

            this.uploadSpeed = speed;
            this.client.send('sendUploadSpeed', this.uploadSpeed);
        });
    }
}

module.exports = LiveLook;
