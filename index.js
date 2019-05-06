const Client = require('./lib/client');
const EventEmitter = require('events').EventEmitter;
const Peer = require('./lib/peer');
const PeerServer = require('./lib/peer-server');
const ThrottleGroup = require('stream-throttle').ThrottleGroup;
const buildList = require('./lib/build-list');
const makeToken = require('./lib/make-token');
const path = require('path');
const pkg = require('./package');
const stream = require('stream');
const tmp = require('tmp');
const uploadSpeed = require('./lib/upload-speed');

tmp.setGracefulCleanup();

// TODO monitor the share directory for the file being deleted, then cancel
// the current uploads with that file

class LiveLook extends EventEmitter {
    constructor(args) {
        super();

        this.username = args.username;
        this.password = args.password;
        this.server = args.server || 'server.slsknet.org';
        this.port = args.port || 2242;
        this.waitPort = args.waitPort || 2234;
        this.sharedFolder = args.sharedFolder;
        this.downloadFolder = args.downloadFolder;
        this.description = args.description || pkg.homepage;
        this.autojoin = args.autojoin || [];
        this.maxPeers = args.maxPeers || 100;
        this.uploadSlots = args.uploadSlots || 2;
        this.downloadSlots = args.downloadSlots || 2;
        this.uploadThrottle = args.uploadThrottle || 56 * 1024;
        this.downloadThrottle = args.downloadThrottle || 56 * 1024;

        if (!this.downloadFolder) {
            this.downloadFolder = tmp.dirSync({ prefix: 'livelook-' }).name;
        }

        if (!Array.isArray(this.autojoin)) {
            this.autojoin = [ this.autojoin ];
        }

        // our online status (1 away, 2 online)
        this.status = 2;

        // the share list
        // { dir: [ { file, size, ... } ]
        this.shareList = {};

        // these are only P type peers, not F or D
        // { ip: { Peer } }
        this.peers = {};

        // { username: ip }
        this.peerAddresses = {};

        // our *active* transfers
        // { token: { file: { file, size, ... }, dir: String, peer: Peer } }
        this.uploads = {};
        this.downloads = {};

        // pending transfers
        // [ ]
        this.uploadQueue = [];
        this.downloadQueue = [];

        // not exactly a queue - these are files we requested and others have
        // queued
        // { file: { file, size, ... } }
        this.toDownload = {};

        // which rooms we're in
        // { room: [ { users }, ... ] }
        this.rooms = {};

        // ticker messages! these usually spam on the top of the chatroom you're
        // in. an alternate implementation could use them as status messages
        // { room: { username: tickerMessage } }
        this.tickers = {};

        // cache gzipped search results (?) and our shares
        this.cache = {};

        // TODO add ability to change the rate later
        this.uploadThrottler = new ThrottleGroup({ rate: this.uploadThrottle });
        this.downloadThrottler = new ThrottleGroup({
            rate: this.downloadThrottle
        });

        // the connection to soulseek's server
        this.client = new Client({ ip: this.server, port: this.port });
        this.client.attachHandlers(this);

        // our server to accept peer connections
        this.peerServer = new PeerServer({
            port: this.waitPort,
            maxPeers: this.maxPeers
        }, this);

        this.peerServer.on('error', err => this.emit('error', err));
        this.peerServer.on('waitPort', waitPort => this.setWaitPort(waitPort));

        // are we sucessfully logged in?
        this.loggedIn = false;
    }

    // populate our share list and connect to the soulseek server
    init(done) {
        done = done || (() => {});

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
        done = done || (() => {});

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

    // login (or connect first) to the soulseek server and send our initializing
    // packets (upload speed, share count, joined rooms, etc.)
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

            this.refreshShareCount();
            this.refreshUploadSpeed();
            this.autojoin.forEach(room => this.joinRoom(room));

            if (this.peerServer.connected) {
                return done(null, res);
            }

            this.peerServer.init(err => {
                if (err) {
                    this.emit('error', err);
                    return done(err);
                }

                done(null, res);
            });
        });

        this.client.send('login', this.username, this.password);
    }

    // this is the port our peer server listens on
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

    // accepts 2 for online, 1 for away, or the corresponding strings
    setStatus(status) {
        if (status) {
            if (!isNaN(+status)) {
                this.status = status;
            } else {
                this.status = status === 'online' ? 2 : 1;
            }
        }

        this.client.send('setStatus', this.status);
    }

    // count the amount of files we're sharing and send them to the server
    refreshShareCount() {
        let dirs = Object.keys(this.shareList).length;
        let files = 0;

        for (let dir of Object.keys(this.shareList)) {
            files += this.shareList[dir].length;
        }

        this.client.send('sharedFoldersFiles', dirs, files);
    }

    // fetch the upload speed from speedtest.net's api
    refreshUploadSpeed(done) {
        done = done || (() => {});

        uploadSpeed((err, speed) => {
            if (err) {
                this.emit('error', err);
                return done(err);
            }

            this.uploadSpeed = speed;
            this.client.send('sendUploadSpeed', this.uploadSpeed);
            done(null, speed);
        });
    }

    // fetch one of our shared files (usually to send to another user)
    getSharedFile(filePath) {
        let file = filePath.replace(/\\/g, '/');
        let dir = path.dirname(file);
        let basename = path.basename(file);

        let mappedDir = this.shareList[dir];
        mappedDir = mappedDir ? mappedDir.map(file => file.file) : [];
        let filePos = mappedDir.indexOf(basename);

        if (filePos === -1) {
            return null;
        }

        return this.shareList[dir][filePos];
    }

    // check if the transfer is already in progress
    isTransferring(transfer, isUpload) {
        let transfers = isUpload ? this.uploads : this.downloads;

        for (let token of Object.keys(transfers)) {
            let c = transfers[token];
            let isSending = c.peer.ip === transfer.peer.ip &&
                c.file.file === transfer.file.file && c.dir === transfer.dir;

            if (isSending) {
                return true;
            }
        }

        return false;
    }

    // get the position of an upload for a peer
    getUploadQueuePos(upload) {
        for (let i = 0; i < this.uploadQueue.length; i += 1) {
            let toUpload = this.uploadQueue[i];
            let isQueued = toUpload.peer.ip === upload.peer.ip &&
                toUpload.file.file === upload.file.file &&
                toUpload.dir === upload.dir;

            if (isQueued) {
                return i;
            }
        }

        return -1;
    }

    // get the ip and address of a user from their username
    getPeerAddress(username, done) {
        if (this.peerAddresses[username]) {
            return done(null, this.peerAddresses[username]);
        }

        this.client.send('getPeerAddress', username);

        let addressTimeout = setTimeout(() => {
            done(new Error(`timed out fetching ${username} address`));
        }, 5000);

        let onAddress = res => {
            if (res.username === username) {
                clearTimeout(addressTimeout);
                this.removeListener('getPeerAddress', onAddress);

                if (res.ip === '0.0.0.0' && res.port === 0) {
                    // explicitly send null here
                    done(null, null);
                } else {
                    done(null, res);
                }
            }
        };

        this.on('getPeerAddress', onAddress);
    }

    // connect to a peer from an IP address and port (and token if available)
    // TODO a user's IP may change, so we should probably try again
    connectToPeerAddress(address, done) {
        let finished = false;

        let connectTimeout = setTimeout(() => {
            done(new Error('timed out connecting to address directly:' +
                `${address.ip}:${address.port}`));
        }, 5000);

        // try to connect to them directly...
        let peer = new Peer(address);
        peer.token = makeToken();

        peer.once('error', err => {
            if (!finished) {
                clearTimeout(connectTimeout);
                finished = true;
                done(err);
            }
        });

        peer.attachHandlers(this);
        peer.init(() => {
            if (!finished) {
                clearTimeout(connectTimeout);
                finished = true;
                //peer.pierceFirewall();
                peer.send('peerInit', this.username, 'P', peer.token);
                done(null, peer);
            }
        });
    }

    // try to establish a connection to a peer with soulseek's server as an
    // intermediate. this is usually done after we try to directly connect
    // to them. don't use this directly
    connectToPeerUsername(username, done) {
        // all the closures here need access to these to remove them when
        // completed
        let onCantConnect, onPeerConnect;

        let token = makeToken();

        let peerTimeout = setTimeout(() => {
            this.removeListener('cantConnectToPeer', onCantConnect);
            this.removeListener('peerConnect', onPeerConnect);
            done(new Error('peer took longer than 5 seconds to connect to us'));
        }, 5000);

        // server let us know the peer couldn't connect to us
        onCantConnect = res => {
            if (res.token === token) {
                clearTimeout(peerTimeout);
                this.removeListener('cantConnectToPeer', onCantConnect);
                this.removeListener('peerConnect', onPeerConnect);
            }
        };

        // we connected to a peer, but it may not have been the one we fired off
        // here
        onPeerConnect = peer => {
            if (peer.token === token) {
                clearTimeout(peerTimeout);
                this.removeListener('cantConnectToPeer', onCantConnect);
                this.removeListener('peerConnect', onPeerConnect);
                done(null, peer);
            }
        };

        this.on('cantConnectToPeer', onCantConnect);
        this.on('peerConnect', onPeerConnect);
        this.client.send('connectToPeer', token, username, 'P');
    }

    // get a Peer instance from a username string by any mean's necessary!
    getPeerByUsername(username, done) {
        // first check our already-connected peers
        for (let ip of Object.keys(this.peers)) {
            let peer = this.peers[ip];

            if (peer.username === username) {
                return done(null, peer);
            }
        }

        this.getPeerAddress(username, (err, address) => {
            if (err) {
                return done(err);
            }

            // peer is offline, don't bother
            if (!address) {
                return done(null, null);
            }

            this.connectToPeerAddress(address, (err, peer) => {
                if (err) {
                    // TODO maybe send 1001 here?
                    this.connectToPeerUsername(username, done);
                    return;
                }

                done(null, peer);
            });
        });
    }

    // see which files a user is sharing
    // TODO cache this!!
    getShareFileList(username, done) {
        this.getPeerByUsername(username, (err, peer) => {
            let onShareList;

            if (err || !peer) {
                return done(new Error(`unable to connect to ${username}`));
            }

            let shareListTimeout = setTimeout(() => {
                this.removeListener('sharedFileList', onShareList);
                done(new Error('timed out getting share file list for ' +
                    username));
            }, 15000); // this is a pretty generous time

            onShareList = res => {
                if (res.peer.username === username) {
                    clearTimeout(shareListTimeout);
                    this.removeListener('sharedFileList', onShareList);
                    done(null, res.shareList);
                }
            };

            this.on('sharedFileList', onShareList);
            peer.send('getShareFileList');
        });
    }

    // search a specific user's shares
    searchUserShares(username, query, done) {
        this.getPeerByUsername(username, (err, peer) => {
            let onSearchResult;

            if (err || !peer) {
                return done(new Error(`unable to connect to ${username}`));
            }

            let token = makeToken();

            let searchTimeout = setTimeout(() => {
                this.removeListener('fileSearchResult', onSearchResult);
                done(new Error('timed out searching share file list for ' +
                    username));
            }, 15000);

            onSearchResult = res => {
                // it's unlikely but we could've generated the same token
                // twice
                if (res.peer.username === username && res.token === token) {
                    clearTimeout(searchTimeout);
                    this.removeListener('fileSearchResult', onSearchResult);
                    done(null, res);
                }
            };

            this.on('fileSearchResult', onSearchResult);
            peer.send('fileSearchRequest', token, query);
        });
    }

    getUserInfo(username, done) {
        this.getPeerByUsername(username, (err, peer) => {
            let onInfoReply;

            if (err || !peer) {
                return done(new Error(`unable to connect to ${username}`));
            }

            let infoTimeout = setTimeout(() => {
                this.removeListener('fileSearchResult', onSearchResult);
                done(new Error('timed out fetchung user info for ' + username));
            }, 5000);

            onInfoReply = res => {
                if (res.peer.username === username) {
                    clearTimeout(infoTimeout);
                    this.removeListener('userInfoReply', onInfoReply);
                    done(null, res);
                }
            };

            this.on('userInfoReply', onInfoReply);
            peer.send('userInfoRequest');
        });
    }

    // request the contents of a specific directory of a peer
    getFolderContents(username, dir, done) {
        dir = dir.replace(/\//g, '\\');

        this.getPeerByUsername(username, (err, peer) => {
            let onFolderResponse;

            if (err || !peer) {
                return done(new Error(`unable to connect to ${username}`));
            }

            let folderTimeout = setTimeout(() => {
                this.removeListener('folderContentsResponse', onFolderResponse);
                done(new Error('timed out getting folder response for ' +
                    username));
            }, 5000);

            onFolderResponse = res => {
                let resDir = Object.keys(res.requests)[0];

                if (res.peer.username === username && resDir === dir) {
                    clearTimeout(folderTimeout);
                    this.removeListener('folderContentsResponse',
                        onFolderResponse);
                    done(null, res.requests[resDir]);
                }
            };

            this.on('folderContentsResponse', onFolderResponse);
            peer.send('folderContentsRequest', dir);
        });
    }

    // download a file from a user. the file should be the full path
    downloadFile(username, file, fileStart = 0) {
        let downloadStream = new stream.PassThrough();

        this.getPeerByUsername(username, (err, peer) => {
            if (err || !peer) {
                return done(new Error(`unable to connect to ${username}`));
            }

            let token = makeToken();

            let download = {
                file: path.basename(file),
                dir: path.dirname(file),
                fileStart,
                peer
            };

            // TODO check download sslots
            this.downloads[token] = download;

            let onQueue = res => {
                if (res.token === token) {
                    this.removeListener('queueDownload', onQueue);
                    downloadStream.emit('queue');
                }
            };

            let onStart = res => {
                this.removeListener('startDownload', onStart);
                this.removeListener('queueDownload', onQueue);

                console.log('a download is habbening');

                if (res.download.file !== download.file ||
                    res.download.dir !== download.dir) {
                    return;
                }

                console.log('it\'s for our file');

                let downloadToken = res.token;

                let onData = res => {
                    if (res.token === downloadToken) {
                        downloadStream.write(res.data);
                    }
                };

                let onEnd = res => {
                    if (res.token === downloadToken) {
                        this.removeListener('endDownload', onEnd);
                        this.removeListener('fileData', onData);
                        downloadStream.end();
                    }
                };

                this.on('fileData', onData);
                this.on('endDownload', onEnd);
            };

            this.on('startDownload', onStart);
            file = file.replace(/\//g, '\\');
            peer.send('transferRequest', 0, token, file);
        });

        return downloadStream;
    }
}

module.exports = LiveLook;
