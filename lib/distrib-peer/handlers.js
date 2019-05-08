module.exports = (livelook, peer) => {
    const handlers = {
        error: err => livelook.emit('error', err),
        connect: () => {
            livelook.parentPeer = peer;
            livelook.emit('peerConnect', peer);
        },
        close: () => {
            console.log('distrib peer closed - we have to find a new one');
            livelook.parentPeer = null;
            this.connectToNextParent();
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
            console.log('recvd search for ', res.query, ' from ', res.username);
            livelook.respondToPeerSearch(res.username, res.token, res.query);
        }
    };

    Object.keys(handlers).forEach(h => peer.on(h, handlers[h]));
};
