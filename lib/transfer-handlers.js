const fs = require('fs');

module.exports = (livelook, peer) => {
    const handlers = {
        error: err => livelook.emit('error', err),
        close: () => {
            // TODO emit upload failed
            delete livelook.uploads[peer.fileToken];
        },
        token: token => {
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
        }
    };

    Object.keys(handlers).forEach(h => peer.on(h, handlers[h]));
};
