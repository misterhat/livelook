const fs = require('fs');
const makeToken = require('../make-token');
const net = require('net');
const toPeer = require('../message/to-peer');

module.exports = (livelook, peer) => {
    const handlers = {
        error: err => livelook.emit('error', err),
        close: () => {
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
        },
        fileToken: (token, start)  => {
            let transfer = livelook.getTransfer(token);

            if (!transfer) {
                return;
            }

            let filePath = './' + transfer.dir + '/' + transfer.file.file;
            let fileStream = fs.createReadStream(filePath, { start });
            fileStream = fileStream.pipe(livelook.uploadThrottler.throttle());
            // this could happen if the user deletes the file as it's uploading
            fileStream.on('error', err => {
                peer.socket.end();
                livelook.emit('error', err);
            });
            fileStream.on('end', () => peer.socket.end());
            fileStream.pipe(peer.socket);
        }
    };

    Object.keys(handlers).forEach(h => peer.on(h, handlers[h]));
};
