const TransferPeer = require('../transfer-peer');
const fs = require('fs');
const makeToken = require('../make-token');
const path = require('path');
const toPeer = require('../message/to-peer');
const transferHandlers = require('../transfer-handlers');

module.exports = (livelook, peer) => {
    const handlers = {
        error: err => livelook.emit('error', err),
        connect: () => {
            livelook.peers[peer.ip] = peer;
            livelook.emit('peerConnect', peer);
        },
        close: () => {
            delete livelook.peers[peer.ip];
            livelook.emit('peerClose', peer);
        },
        getShareFileList: () => peer.send('sharedFileList', livelook.shareList),
        userInfoRequest: () => {
            peer.send('userInfoReply', {
                description: livelook.description,
                picture: livelook.picture,
                uploadSlots: livelook.uploadSlots,
                queueSize: 0,
                slotsFree: !Object.keys(livelook.uploads).length,
                uploadsAllowed: 0 // who we allow upload from
            });
        },
        transferRequest: res => {
            // somebody wants to download (we are uploading)
            if (res.direction !== 0) {
                return;
            }

            let file = res.file.replace(/\\/g, '/');
            let dir = path.dirname(file);
            let basename = path.basename(file);

            let mappedDir = livelook.shareList[dir];
            mappedDir = mappedDir ? mappedDir.map(file => file.file) : [];
            let filePos = mappedDir.indexOf(basename);

            if (filePos === -1) {
                // TODO this should trigger an error and possibly ban the user
                //peer.send('transferResponse', res.token, false, 'Unavailable');
                return;
            }

            // TODO probably have to make an Upload class
            file = livelook.shareList[dir][filePos];
            let upload = { file, dir, peer };
            // TODO we need a way to format file+dir

            for (let token of Object.keys(livelook.uploads)) {
                let c = livelook.uploads[token];
                let isSending = c.peer.ip === peer.ip &&
                    c.file.file === basename && c.dir === dir;

                // nicotine doesn't even do this
                if (isSending) {
                    return peer.send('transferResponse', res.token, false,
                        'In Progress');
                }
            }

            // TODO we'll have to check if it's in the queue of course
            let inProgress = Object.keys(livelook.uploads).length;

            if (inProgress >= livelook.uploadSlots) {
                livelook.uploadQueue.push({ ...upload, token: res.token });

                peer.send('transferResponse', res.token, false, 'Queued');
                return peer.send('placeInQueue', res.file,
                    livelook.uploadQueue.length);
            }

            livelook.uploads[res.token] = upload;
            peer.send('transferResponse', res.token, true, file.size);
            livelook.emit('startUpload', { token: res.token, upload });
        },
        // a peer sends us this after we send them a transfer request for an
        // upload or download
        transferResponse: res => {
            if (!res.allowed) {
                return;
            }

            console.log('ok, peer is responding to one of our xfer reqs.', res);

            let token = res.token;
            let transfer = livelook.getTransfer(token);
            let peer = transfer.peer;

            if (!transfer) {
                return;
            }

            console.log('we must make a new TransferPeer and send PeerInitF', transfer);
            let transferPeer = new TransferPeer({
                ip: transfer.peer.ip,
                port: transfer.peer.port,
                token: makeToken()
            });

            let isSending = false;

            transferPeer.socket.on('data', data => {
                if (!isSending) {
                    console.log('first bit of data');
                    isSending = true;
                } else {
                    console.log('second bit, we\'re done?');
                    isSending = false;
                    return;
                }

                console.log('xfer peer sent us something');
                console.log('start sending the file lol');

                // TODO move the bottom to a fileSender
                let filePath = './' + transfer.dir + '/' + transfer.file.file;
                let fileStream = fs.createReadStream(filePath);

                fileStream = fileStream.pipe(livelook.uploadThrottler.throttle());
                fileStream.on('error', err => livelook.emit('error', err));

                fileStream.on('end', () => {
                    livelook.emit('endUpload', { token, upload: transfer });
                    //transferPeer.socket.write('00000000', 'hex');
                    transferPeer.socket.close();
                });

                fileStream.pipe(transferPeer.socket);
            });

            transferPeer.init(() => {

                transferPeer.pierceFirewall();
                // THIS IS NOT THE FILE SOCKET
                let buff = toPeer.peerInit(livelook.username, 'F', token).getBuff();
                console.log(buff);
                transferPeer.socket.write(buff);

                //setTimeout(() => {
                    let b = Buffer.alloc(4);
                    b.writeUInt32LE(token);
                    transferPeer.socket.write(b);
                //}, 100);
            });
        }
    };

    Object.keys(handlers).forEach(h => peer.on(h, handlers[h]));
};
