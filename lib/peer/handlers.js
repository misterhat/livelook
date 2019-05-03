const TransferPeer = require('../transfer-peer');
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
            console.log('deleting uploads and queued items from peer');
            // TODO do that
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
                return;
            }

            file = livelook.shareList[dir][filePos];
            let upload = { file, dir, peer };

            for (let token of Object.keys(livelook.uploads)) {
                let c = livelook.uploads[token];
                let isSending = c.peer.ip === peer.ip &&
                    c.file.file === basename && c.dir === dir;

                // nicotine doesn't even do this
                if (isSending) {
                    return;
                }
            }

            for (let toUpload of livelook.uploadQueue) {
                let isQueued = toUpload.peer.ip === upload.peer.ip &&
                    toUpload.file.file === file.file && toUpload.dir === dir;

                if (isQueued) {
                    peer.send('transferResponse', res.token, false, 'Queued');
                    return;
                }
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
                port: transfer.peer.port
            });

            transferPeer.fileToken = res.token;
            transferHandlers(livelook, transferPeer);
            transferPeer.init(() => {
                transferPeer.pierceFirewall();
                transferPeer.peerInit(livelook.username);
                transferPeer.sendFileToken(res.token);
            });
        }
    };

    Object.keys(handlers).forEach(h => peer.on(h, handlers[h]));
};
