const fs = require('fs');
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
            uploadsAllowed: 0 // who we allow upload froms
        });
    });

    peer.on('transferRequest', res => {
        // download
        if (res.direction !== 0) {
            return;
        }

        let inProgress = Object.keys(livelook.uploads).length;

        if (inProgress >= livelook.uploadSlots) {
            let reason = inProgress + '/' + livelook.uploadSlots;
            peer.send('transferResponse', res.token, false, reason);
            return;
        }

        let allowed = true;

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

        file = livelook.shareList[dir][filePos];

        // TODO use lazy stream maybe
        livelook.uploads[peer.ip] = fs.createReadStream('./' + dir + '/' + basename);

        peer.send('transferResponse', res.token, allowed, file.size);
    });

    peer.init(() => peer.send('pierceFirewall', peer.token));
};
