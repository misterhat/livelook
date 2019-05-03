const fs = require('fs');
const toPeer = require('./message/to-peer');
const makeToken = require('./make-token');
const net = require('net');

module.exports = (livelook, peer) => {
    const handlers = {
        error: err => livelook.emit('error', err), // TODO peer should emit
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
            fileStream.on('error', err => livelook.emit('error', err));
            fileStream.on('end', () => peer.socket.end());
            fileStream.pipe(peer.socket);
        }
    };

    Object.keys(handlers).forEach(h => peer.on(h, handlers[h]));
};
