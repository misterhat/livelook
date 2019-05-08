// handle events from P type peers

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
        userInfoReply: res => {
            res.peer = peer;
            delete res.type;
            livelook.emit('userInfoReply', res);
        },
        folderContentsRequest: res => {
            let response = {};

            for (let dir of res.dirs) {
                let ourDir = this.shareList[dir];

                if (ourDir) {
                    response[dir] = { dir: ourDir };
                }
            }

            peer.send('folderContentsResponse', response);
        },
        folderContentsResponse: res => {
            res.peer = peer;
            delete res.type;
            livelook.emit('folderContentsResponse', res);
        },
        // this is nonstandard but nicotine supports it
        messageUser: res => {
            peer.send('messageAcked', res.id);
            livelook.emit('messageUser', res);
        },
        transferRequest: res => {
            // somebody wants to download (we are uploading)
            if (res.direction === 0) {
                let file = livelook.getSharedFile(res.file);

                console.log('getting xfer req for ', res.file);

                if (!file) {
                    console.log(res.file, 'not found for xfer');
                    return;
                }

                let dir = res.file.replace(/\\/g, '/');
                dir = path.dirname(dir);
                let upload = { file, dir, peer };

                // nicotine doesn't even do this
                if (livelook.isTransferring(upload, true)) {
                    console.log(res.file, 'were alrdy xfering it');
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
                    peer.send('placeInQueue', res.file, queueLength);

                    livelook.emit('queueUpload', {
                        token: res.token,
                        upload,
                        position: queueLength
                    });

                    return;
                }

                livelook.uploads[res.token] = upload;
                peer.send('transferResponse', res.token, true, file.size);
                livelook.emit('startUpload', { token: res.token, upload });
            } else {
                console.log(Object.keys(livelook.toDownload));
                let download = livelook.toDownload[res.file];

                if (!download) {
                    return;
                }

                // TODO check download slots
                livelook.downloads[res.token] = download;
                delete livelook.toDownload[res.file]
                peer.send('transferResponse', res.token, true);

                // TODO this is copypastad
                let transferPeer = new TransferPeer({
                    ip: download.peer.ip,
                    port: download.peer.port,
                    isUpload: false
                });

                transferPeer.fileToken = res.token;
                transferPeer.fileStart = download.fileStart;
                transferPeer.fileSize = res.size;
                transferPeer.attachHandlers(livelook);

                transferPeer.init(() => {
                    transferPeer.peerInit(livelook.username);
                    transferPeer.sendFileToken(res.token);
                    transferPeer.sendFileStart();
                    livelook.emit('startDownload', {
                        token: res.token,
                        download
                    });
                });
            }
        },
        // a peer sends us this after we send them a transfer request for an
        // upload or download
        transferResponse: res => {
            let upload = livelook.uploads[res.token];
            let download = livelook.downloads[res.token];
            let transfer = upload || download;
            let isUpload = !!upload;

            if (!res.allowed) {
                // the user had sent an earlier transferResponse accepting
                // this file, but changed their mind
                if (transfer && /cancel/i.test(res.reason)) {
                    transfer.peer.socket.destroy();

                    if (isUpload) {
                        delete livelook.uploads[res.token];
                    } else {
                        delete livelook.downloads[res.token];
                    }

                    return;
                }

                // we sent a download request, the user declined
                // but put us in their queue
                if (transfer && /queue/i.test(res.reason)) {
                    let fileName = transfer.dir.replace(/\//g, '\\');
                    fileName += '\\' + transfer.file;
                    livelook.toDownload[fileName] = transfer;
                    delete livelook.downloads[res.token];
                    console.log('denied download but placed in queue', res);
                    livelook.emit('queueDownload', {
                        token: res.token,
                        download: transfer
                    });
                }

                return;
            }

            if (!transfer) {
                return;
            }

            if (isUpload) {
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
					transferPeer.sendFileToken();
				});
            } else {
				// the F connection
				let transferPeer = new TransferPeer({
					ip: transfer.peer.ip,
					port: transfer.peer.port,
                    isUpload: false
				});

                transferPeer.fileToken = res.token;
                transferPeer.fileStart = transfer.fileStart;
                transferPeer.fileSize = res.size;
				transferPeer.attachHandlers(livelook);

                transferPeer.init(() => {
                    transferPeer.peerInit(livelook.username);
                    transferPeer.sendFileToken(res.token);
                    transferPeer.sendFileStart();
                    livelook.emit('startDownload', {
                        token: res.token,
                        download
                    });
                });
            }
        },
        queueUpload: res => {
            let file = livelook.getSharedFile(res.file);

            if (!file) {
                return;
            }

            let dir = res.file.replace(/\\/g, '/');
            dir = path.dirname(dir);
            let upload = { file, dir, peer };

            if (livelook.isTransferring(upload, true)) {
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
            // TODO we should move startUpload to the xfer peer maybe
        }
    };

    Object.keys(handlers).forEach(h => peer.on(h, handlers[h]));
};
