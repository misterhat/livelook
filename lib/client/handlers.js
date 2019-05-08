// handle events from soulseek servers

const Peer = require('../peer');
const TransferPeer = require('../transfer-peer');

module.exports = (livelook, client) => {
    const handlers = {
        error: err => livelook.emit('error', err),
        getPeerAddress: res => {
            livelook.peerAddresses[res.username] = {
                ip: res.ip,
                port: res.port
            };

            // remove the peer address after 10 minutes, in case they have
            // reconnected and changed ips/ports somehow
            setTimeout(() => {
                delete livelook.peerAddresses[res.username];
            }, 1000 * 60 * 10);

            livelook.emit('getPeerAddress', res);
        },
        joinRoom: res => livelook.rooms[res.room] = res.users,
        sayChatroom: res => livelook.emit('sayChatroom', res),
        leaveRoom: res => {
            livelook.emit('leaveRoom', res.room);
            delete livelook.rooms[res.room];
        },
        userJoinedRoom: res => {
            let room = livelook.rooms[res.room];

            if (!room) {
                room = [];
                livelook.rooms[res.room] = room;
            }

            livelook.emit('userJoinedRoom', res);

            let user = { ...res };
            delete user.room;
            room.push(user);
        },
        userLeftRoom: res => {
            let room = livelook.rooms[res.room];

            if (!room) {
                return;
            }

            livelook.emit('userLeftRoom', res);

            let i;
            for (i = 0; i < room.length; i += 1) {
                if (room[i].username === res.username) {
                    room.splice(i, 1);
                    break;
                }
            }
        },
        // this is sent to us by the server if a peer was unable to directly
        // connect to our peer server
        connectToPeer: res => {
            if (res.cType === 'P') {
                if (Object.keys(livelook.peers).length >= this.maxPeers) {
                    console.log('too many peers!');
                    return;
                }

                if (livelook.peers[res.ip]) {
                    return;
                }

                // TODO maybe livelook.addPeer
                let peer = new Peer(res);
                peer.attachHandlers(livelook);
                peer.init(() => peer.pierceFirewall());
            } else if (res.cType === 'F') {
                let transferPeer = new TransferPeer(res);
                transferPeer.isUpload = res.direction === 1;
                transferPeer.attachHandlers(livelook);
                transferPeer.init(() => transferPeer.pierceFirewall());
            } else if (res.cType === 'D') {
                console.log('server sent us a D connection', res);
            }
        },
        messageUser: res => {
            client.send('messageAcked', res.id);
            livelook.emit('messageUser', res);
        },
        relog: () => {
            livelook.loggedIn = false;
            livelook.emit('error', new Error('kicked off due to name ' +
                'conflict'));
            process.exit(1);
        },
        netInfo: res => {
            console.log('we got netinfo!!! potential parents', res.parents);
            livelook.potentialParents = res.parents;
            livelook.connectToNextParent();
        },
        roomTickerState: res => {
            livelook.tickers[res.room] = res.users;
            livelook.emit('roomTickerState', res);
        },
        roomTickerAdd: res => {
            try {
                livelook.tickers[res.room][res.user] = res.ticker;
            } catch (e) {
                let err = new Error('server sent us a ticker to invalid ' +
                    `room: ${res.room}, username: ${res.username}, ticker: ` +
                    res.ticker);
                livelook.emit('error', err);
            }

            livelook.emit('roomTickerAdd', res);
        },
        roomTickerRemove: res => {
            try {
                delete livelook.tickers[res.room][res.user];
            } catch (e) {
                let err = new Error('server told us to delete ticker to ' +
                    `invalid room: ${res.room}, username: ${res.username}`);
                livelook.emit('error', err);
                return;
            }

            livelook.emit('roomTickerRemove', res);
        },
        cantConnectToPeer: res => {
            livelook.emit('cantConnectToPeer', res);
        }
    };

    Object.keys(handlers).forEach(h => client.on(h, handlers[h]));
};
