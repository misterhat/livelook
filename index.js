const Client = require('./lib/client');
const EventEmitter = require('events').EventEmitter;
const PeerServer = require('./lib/peer-server');
const async = require('async');
const buildList = require('./lib/build-list');
const clientHandlers = require('./lib/client-handlers');
const makeToken = require('./lib/make-token');
const pkg = require('./package');
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
        this.description = args.description || pkg.homepage;
        this.autojoin = args.autojoin || [];
        this.maxPeers = args.maxPeers || 100;

        if (!Array.isArray(this.autojoin)) {
            this.autojoin = [ this.autojoin ];
        }

        // our online status (1 away, 2 online)
        this.status = 2;

        // the share list pojo
        this.shareList = {};

        // all the users we've collected some information about
        //this.knownUsers = {};
        this.peers = {};

        // which rooms we're in
        // { room: [ { users }, ... ] }
        this.rooms = {};

        // ticker messages!
        // { room: { user: ticker } }
        this.tickers = {};

        // cache gzipped search results (?) and our shares
        this.cache = {};

        // the connection to soulseek's server
        this.client = new Client({ host: this.server, port: this.port });
        clientHandlers(this, this.client);

        // our server to accept peer connections
        this.peerServer = new PeerServer({
            port: this.waitPort,
            maxPeers: this.maxPeers
        });

        this.peerServer.on('waitPort', waitPort => this.setWaitPort(waitPort));

        // are we sucessfully logged in?
        this.loggedIn = false;
    }

    init(done) {
        this.refreshShareList(err => {
            if (err) {
                return done(err);
            }

            this.client.init(err => {
                if (err) {
                    return done(err);
                }

                done();
            });
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
            this.init((err) => {
                this.login(done);
            });

            return;
        }

        this.client.once('login', res => {
            this.loggedIn = res.success;

            if (!this.loggedIn) {
                return done(null, res);
            }

            this.peerServer.init(err => {
                if (err) {
                    this.emit('error', err);
                    return done(err);
                }

                this.refreshShareCount();
                this.refreshUploadSpeed();
                this.autojoin.forEach(room => this.joinRoom(room));

                done(null, res);
            });
        });

        this.client.send('login', this.username, this.password);
    }

    setWaitPort(port) {
        if (port) {
            this.waitPort = port;
        }

        this.client.send('setWaitPort', this.waitPort);
    }

    sayChatroom(room, message) {
        this.client.send('sayChatroom', room, message);
    }

    leaveChatroom(room) {
        this.client.send('leaveChatroom', room);
    }

    joinRoom(room) {
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
