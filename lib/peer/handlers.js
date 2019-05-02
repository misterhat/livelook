const path = require('path');

module.exports = (livelook, peer) => {
    const handlers = {
        error: err => livelook.emit('error', err),
        connect: () => {
            console.log('PEER CONNECTED');
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
                peer.send('transferResponse', res.token, false, 'Unavailable');
                return;
            }

            // TODO probably have to make an Upload class
            file = livelook.shareList[dir][filePos];
            let upload = { file, dir, peer };

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
                //livelook.queueUploads.push(
                peer.send('transferResponse', res.token, false, 'Queued');
                return peer.send('placeInQueue', res.file,
                    livelook.queueUploads.length);
            }

            livelook.uploads[res.token] = upload;
            peer.send('transferResponse', res.token, true, file.size);
            livelook.emit('startUpload', { token: res.token, upload });
        }
    };

    Object.keys(handlers).forEach(h => peer.on(h, handlers[h]));
};
