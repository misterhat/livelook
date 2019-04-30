// handle events from soulseek servers

module.exports = (livelook, client) => {
    client.on('getPeerAddress', res => {
        if (!livelook.peers[res.username]) {
            livelook.peers[res.username] = {};
        }

        let peer = livelook.peers[res.username];
        peer.ip = res.ip;
        peer.port = res.port;
    });

    client.on('joinRoom', res => {
        livelook.rooms[res.room] = res.users;
    });

    client.on('sayChatroom', res => {
        livelook.emit('sayChatroom', {
            room: res.room,
            username: res.username,
            message: res.message
        });
    });

    client.on('leaveRoom', res => {
        delete livelook.rooms[res.room];
    });

    client.on('userJoinedRoom', res => {
        let room = livelook.rooms[res.room];

        if (!room) {
            room = [];
            livelook.rooms[res.room] = room;
        }

        livelook.emit('userJoinedRoom', res);

        let user = { ...res };
        delete user.room;
        room.push(user);
    });

    client.on('userLeftRoom', res => {
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
    });

    client.on('messageUser', res => {
        client.send('messageAcked', res.id);
        livelook.emit('messageUser', res);
    });

    client.on('relog', () => {
        livelook.loggedIn = false;
        livelook.emit('error', new Error('kicked off due to name conflict'));
    });

    client.on('roomTickerState', res => {
        livelook.tickers[res.room] = res.users;
        livelook.emit('roomTickerState', res);
    });

    client.on('roomTickerAdd', res => {
        try {
            livelook.tickers[res.room][res.user] = res.ticker;
        } catch (e) {
            let err = new Error(`server sent us a ticker to room we\'re not ` +
                `in. room: ${res.room}, username: ${res.username}, ticker: ` +
                res.ticker);
            livelook.emit('error', err);
        }

        livelook.emit('roomTickerAdd', res);
    });

    client.on('roomTickerRemove', res => {
        try {
            delete livelook.tickers[res.room][res.user];
        } catch (e) {
            let err = new Error('server told us to delete ticker to room ' +
                `we're not in. room: ${res.room}, username: ${res.username}`);
            livelook.emit('error', err);
        }

        livelook.emit('roomTickerRemove', res);
    });

    client.on('error', err => livelook.emit('error', err));
};
