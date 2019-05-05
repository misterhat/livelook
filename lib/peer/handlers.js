const TransferPeer = require('../transfer-peer');
const path = require('path');
const toPeer = require('../message/to-peer');
const makeToken = require('../make-token');

module.exports = (livelook, peer) => {
    const handlers = {
        error: err => {
            err.peer = peer;
            livelook.emit('error', err)
        },
        connect: () => {
            this.connected = true;
            livelook.peers[peer.ip] = peer;
            livelook.emit('peerConnect', peer);
        },
        close: () => {
            this.connected = false;
            delete livelook.peers[peer.ip];
            livelook.emit('peerClose', peer);
        },
        getShareFileList: () => peer.send('sharedFileList', livelook.shareList),
        sharedFileList: res => {
            livelook.emit('sharedFileList', { peer, shareList: res });
        },
        fileSearchResult: res => {
            res.peer = peer;
            delete res.type;
            livelook.emit('fileSearchResult', res);
        },
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
        // this is nonstandard but nicotine supports it
        messageUser: res => {
            peer.send('messageAcked', res.id);
            livelook.emit('messageUser', res);
        },
        transferRequest: res => {
            // somebody wants to download (we are uploading)
            if (res.direction !== 0) {
                return;
            }

            let file = livelook.getSharedFile(res.file);

            if (!file) {
                return;
            }

            let dir = res.file.replace(/\\/g, '/');
            dir = path.dirname(dir);
            let upload = { file, dir, peer };

            // nicotine doesn't even do this
            if (livelook.isUploading(upload)) {
                return;
            }

            let queuePos = livelook.getUploadQueuePos(upload);

            if (queuePos > -1) {
                peer.send('transferResponse', res.token, false, 'Queued');
                return;
            }

            let inProgress = Object.keys(livelook.uploads).length;

            if (inProgress >= livelook.uploadSlots) {
                let queueLength = livelook.uploadQueue.push({
                    ...upload, token: res.token
                });

                peer.send('transferResponse', res.token, false, 'Queued');
                return peer.send('placeInQueue', res.file, queueLength);
            }

            peer.send('transferResponse', res.token, true, file.size);
            livelook.uploads[res.token] = upload;
            livelook.emit('startUpload', { token: res.token, upload });
        },
        // a peer sends us this after we send them a transfer request for an
        // upload or download
        transferResponse: res => {
            let transfer = livelook.getTransfer(res.token);

            if (!res.allowed) {
                if (!/cancel/i.test(res.reason)) {
                    return;
                }

                // the user had sent an earlier transferResponse accepting
                // this file, but changed their mind
                if (transfer) {
                    transfer.peer.socket.destroy();
                    delete livelook.uploads[res.token];
                    return;
                }

                return;
            }

            if (!transfer) {
                return;
            }

            // the F connection
            let transferPeer = new TransferPeer({
                ip: transfer.peer.ip,
                port: transfer.peer.port,
            });

            transferPeer.fileToken = res.token;
            transferPeer.attachHandlers(livelook);
            transferPeer.init(() => {
                // TODO check to see when we need to send pierceFirewall
                transferPeer.peerInit(livelook.username);
                transferPeer.sendFileToken(res.token);
            });
        },
        queueUpload: res => {
            let file = livelook.getSharedFile(res.file);

            if (!file) {
                return;
            }

            let dir = res.file.replace(/\\/g, '/');
            dir = path.dirname(dir);
            let upload = { file, dir, peer };

            if (livelook.isUploading(upload)) {
                return;
            }

            let queuePos = livelook.getUploadQueuePos(upload);

            if (queuePos > -1) {
                return peer.send('placeInQueue', res.file, queuePos);
            }

            let inProgress = Object.keys(livelook.uploads).length;

            if (inProgress >= livelook.uploadSlots) {
                let queueLength = livelook.uploadQueue.push({
                    ...upload, token: res.token
                });

                return peer.send('placeInQueue', res.file, queueLength);
            }

            let token = makeToken();
            livelook.uploads[token] = upload;
            peer.send('transferRequest', 1, token, res.file, file.size);
            livelook.emit('startUpload', { token: token, upload });
        }
    };

    Object.keys(handlers).forEach(h => peer.on(h, handlers[h]));
};
