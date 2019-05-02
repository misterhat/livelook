const toPeer = require('./message/to-peer');
const fs = require('fs');

module.exports = (livelook, peer) => {
    peer.on('error', err => livelook.emit('error', err));

    peer.on('token', token => {
        let uploadFile = livelook.uploads[token];
        let downloadFile = livelook.downloads[token];
        let transfer = uploadFile ? uploadFile : downloadFile;

        if (!transfer) {
            let err = new Error('peer attempted file transfer without ' +
                `request. token: ${token}`);
            err.peer = peer;
            livelook.emit('error', err);
            return;
        }

        let filePath = './' + transfer.dir + '/' + transfer.file.file;
        let fileStream = fs.createReadStream(filePath);

        fileStream = fileStream.pipe(livelook.uploadThrottler.throttle());
        fileStream.on('error', err => livelook.emit('error', err));

        fileStream.on('end', () => {
            livelook.emit('endUpload', { token, upload: transfer });
            peer.socket.close();
        });

        fileStream.pipe(peer.socket);
    });

    peer.on('close', () => {
        delete livelook.uploads[peer.fileToken];
    });

    peer.init(() => {
        if (peer.token) {
            peer.socket.write(toPeer.pierceFirewall(peer.token).getBuff());
        }
    });
};
