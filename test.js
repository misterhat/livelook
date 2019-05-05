const LiveLook = require('./');

let livelook = new LiveLook({
    username: 'toadtripler',
    password: 'DEFINITELY TRIPLES TOADS',
    sharedFolder: './mp3s',
    description: 'not responsible for toad-related mutations',
    autojoin: [ 'nicotine' ]
});

livelook.on('error', err => console.error(err));

livelook.login((err, res) => {
    if (err) {
        return console.error(err);
    } else if (!res.success) {
        return console.log('invalid password lol');
    }

    livelook.on('sayChatroom', msg => {
        if (msg.room) {
            console.log(`[${msg.room}] <${msg.username}> ${msg.message}`);
        } else {
            console.log(`<${msg.username}> ${msg.message}`);
        }
    });

    livelook.on('messageUser', msg => {
        console.log(`<${msg.username}> ${msg.message}`);
        livelook.messageUser(msg.username, 'hey fug you guy xD');
    });

    setTimeout(() => {
        //livelook.getPeerAddress('frogdoubler', console.log);
        livelook.connectToPeerUsername('fourfish', (err, peer) => {
            console.log(err, peer);
        });
    }, 1000);
});
