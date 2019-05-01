const pictureTest = require('fs').readFileSync('./frogdoubler.jpeg');

module.exports = (livelook, peer) => {
    peer.on('close', () => delete livelook.peers[peer.ip]);
    peer.on('error', err => livelook.emit('error', err));

    peer.on('getShareFileList', () => {
        console.log(livelook.shareList);
        peer.send('sharedFileList', livelook.shareList);
    });

    peer.on('userInfoRequest', () => {
        peer.send('userInfoReply', {
            description: livelook.description,
            picture: pictureTest,
            uploadSlots: livelook.uploadSlots,
            queueSize: 0,
            slotsFree: true,
            uploadsAllowed: 0
        });
    });

    peer.init(() => peer.send('pierceFirewall', peer.token));
};
