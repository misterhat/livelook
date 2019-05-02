const fs = require('fs');
const TransferPeer = require('./transfer-peer');
const toPeer = require('./message/to-peer');
const makeToken = require('./make-token');
const net = require('net');

module.exports = (livelook, peer) => {
    const handlers = {
        error: err => livelook.emit('error', err),
        close: () => {
            // TODO emit upload failed
            delete livelook.uploads[peer.fileToken];

            console.log('transfer failed or finished, moving onto next item in queue');

            let nextUpload = livelook.uploadQueue.pop();

            if (!nextUpload) {
                console.log('empty queue!');
                return;
            }

            nextUpload.peer.send('transferRequest', 1, nextUpload.token, nextUpload.dir.replace(/\//g, '\\') + '\\' + nextUpload.file.file, nextUpload.file.size);

            /*let transferPeer = new TransferPeer(nextUpload.peer);
            transferPeer.on('error', console.error);*/
            /*let test = net.createConnection({
                host: nextUpload.peer.ip,
                port: nextUpload.peer.port,
            }, () => {
                console.log('directly connected to xfer peer...');
                test.write(toPeer.pierceFirewall(makeToken()).getBuff());
                //test.write(toPeer.peerInit(livelook.username, 'F', makeToken()).getBuff());
                var q = Buffer.alloc(4);
                //q.write(nextUpload.token);
                //test.write(q);
                console.log('PLEASE FUCKING TAKE THIS', nextUpload.token);

                setInterval(() => {
                    test.write(Buffer.alloc(100));
                }, 100);
            });

            test.on('error', err => {
                console.log('XFER PEER ERR :(', err);
            });

            test.on('data', data => {
                console.log('XFER PEER GAVE US DATA!!!!', data);
            });*/
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
