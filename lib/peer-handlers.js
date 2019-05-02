const path = require('path');

module.exports = (livelook, peer) => {
    peer.on('close', () => delete livelook.peers[peer.ip]);
    peer.on('error', err => livelook.emit('error', err));

    peer.on('getShareFileList', () => {
        peer.send('sharedFileList', livelook.shareList);
    });

    peer.on('userInfoRequest', () => {
        peer.send('userInfoReply', {
            description: livelook.description,
            picture: livelook.picture,
            uploadSlots: livelook.uploadSlots,
            queueSize: 0,
            slotsFree: !Object.keys(livelook.uploads).length,
            uploadsAllowed: 0 // who we allow upload from
        });
    });

    peer.on('transferRequest', res => {
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
            peer.send('transferResponse', res.token, false, 'UNAVAILABLE');
            return;
        }

        // TODO probably have to make an Upload class
        file = livelook.shareList[dir][filePos];
        let upload = { file, dir, peer };

        for (let token of Object.keys(livelook.uploads)) {
            let c = livelook.uploads[token];

            // nicotine doesn't even do this
            if (c.peer.ip === peer.ip &&
                c.file.file === basename && c.dir === dir) {
                peer.send('transferResponse', res.token, false, 'In Progress');
                return;
            }
        }

        let inProgress = Object.keys(livelook.uploads).length;

        if (inProgress >= livelook.uploadSlots) {
            //livelook.queueUploads.push(
            peer.send('transferResponse', res.token, false, 'Queued');
            return peer.send('placeInQueue', res.file, inProgress + livelook.queueUploads.length);
        }

        livelook.uploads[res.token] = upload;
        peer.send('transferResponse', res.token, true, file.size);
        livelook.emit('startUpload', { token: res.token, upload });
    });

    peer.init(() => peer.send('pierceFirewall', peer.token));
};
