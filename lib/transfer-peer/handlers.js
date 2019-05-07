const fs = require('fs');
const makeToken = require('../make-token');
const net = require('net');
const toPeer = require('../message/to-peer');

module.exports = (livelook, peer) => {
    const handlers = {
        error: err => livelook.emit('error', err),
        close: () => {
            console.log('it closed');

            let isUpload = !!livelook.uploads[peer.fileToken];

            if (isUpload) {
                livelook.emit('endUpload', {
                    token: peer.fileToken,
                    upload: livelook.uploads[peer.fileToken]
                });

                delete livelook.uploads[peer.fileToken];

                let nextUpload = livelook.uploadQueue.shift();

                if (!nextUpload) {
                    return;
                }

                let token = nextUpload.token;
                delete nextUpload.token;

                let file = nextUpload.dir.replace(/\//g, '\\') + '\\';
                file += nextUpload.file.file;
                let size = nextUpload.file.size;

                livelook.uploads[token] = nextUpload;
                nextUpload.peer.send('transferRequest', 1, token, file, size);
            } else {
                livelook.emit('endDownload', { token: peer.fileToken });
                delete livelook.downloads[peer.fileToken];
                // TODO move onto next download maybe?
            }
        },
        // when we receive a file token
        fileToken: (token, start)  => {
            let upload = livelook.uploads[token];

            if (!upload) {
                return;
            }

            let filePath = './' + upload.dir + '/' + upload.file.file;
            let fileStream = fs.createReadStream(filePath, { start });
            fileStream = fileStream.pipe(livelook.uploadThrottler.throttle());
            fileStream.on('error', err => {
                peer.socket.end();
                livelook.emit('error', err);
            });
            fileStream.on('end', () => peer.socket.end());
            fileStream.pipe(peer.socket);
        },
        fileData: data => {
            livelook.emit('fileData', { token: peer.fileToken, data });
        }
    };

    Object.keys(handlers).forEach(h => peer.on(h, handlers[h]));
};
