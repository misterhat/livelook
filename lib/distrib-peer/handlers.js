module.exports = (livelook, peer) => {
    const handlers = {
        error: err => livelook.emit('error', err),
        connect: () => {
            if (livelook.parentPeer === null) {
                livelook.parentPeer = peer;
                console.log('new parent connected');
                livelook.refreshParentInfo();
            } else {
                console.log('child connected');
                livelook.childPeers[peer.ip] = peer;
                // give us some time to send pierceFw
                setTimeout(() => {
                    peer.send('branchLevel', livelook.branchLevel);
                    peer.send('branchRoot', livelook.branchRoot);
                }, 100);
            }

            livelook.emit('peerConnect', peer);
        },
        close: () => {
            this.connected = false;

            if (livelook.parentPeer === peer)  {
                console.log('our parent disconnected!');
                livelook.parentPeer = null;
                livelook.connectToNextParent();
            } else {
                console.log('one of our children died - no big deal');
                delete livelook.childPeers[peer.ip];
            }

            livelook.emit('peerClose', peer);
        },
        ping: res => {
            if (res.something) {
                peer.send('ping', res.something);
            } else {
                peer.send('ping');
            }
        },
        search: res => {
            //console.log('recvd search for ', res.query, ' from ', res.username);
            livelook.respondToPeerSearch(res.username, res.token, res.query,
                res.something);
        },
        branchRoot: res => {
            if (livelook.parentPeer === peer) {
                console.log('parent peer sent us a new parent (branch root)', res);
                livelook.branchRoot = res.root;
                livelook.client.send('branchRoot', livelook.branchRoot);
                livelook.sendToChildren('branchRoot', livelook.branchRoot);
            }
        },
        branchLevel: res => {
            if (livelook.parentPeer === peer) {
                console.log('parent peer sent us a new branch level', res);
                livelook.branchLevel = res.level;
                livelook.client.send('branchLevel', livelook.branchLevel);
                livelook.sendToChildren('branchLevel', livelook.branchLevel);
            }
        }
    };

    Object.keys(handlers).forEach(h => peer.on(h, handlers[h]));
};
