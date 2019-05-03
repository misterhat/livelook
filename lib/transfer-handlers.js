const fs = require('fs');
const toPeer = require('./message/to-peer');
const makeToken = require('./make-token');
const net = require('net');

module.exports = (livelook, peer) => {
    const handlers = {
        error: err => livelook.emit('error', err), // TODO peer should emit
        close: () => {
            // TODO emit upload failed
            delete livelook.uploads[peer.fileToken];

            console.log('transfer failed or finished, moving onto next item in queue');

            let nextUpload = livelook.uploadQueue.shift();

            if (!nextUpload) {
                console.log('empty queue!');
                return;
            }

            console.log('we\'re going to send', JSON.stringify(nextUpload), 'next');
            let token = nextUpload.token;
            delete nextUpload.token;

            let file = nextUpload.dir.replace(/\//g, '\\') + '\\';
            file += nextUpload.file.file;
            let size = nextUpload.file.size;

            livelook.uploads[token] = nextUpload;
            nextUpload.peer.send('transferRequest', 1, token, file, size);
        },
        token: token => {
            let transfer = livelook.getTransfer(token);

            if (!transfer) {
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

            /*fileStream.on('data', data => {
                console.log('sending file data ', data.length);
                if (!peer.socket.destroyed) {
                    peer.socket.write(data);
                }
            });*/
            fileStream.pipe(peer.socket);
        }
    };

    Object.keys(handlers).forEach(h => peer.on(h, handlers[h]));
};
