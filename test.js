const LiveLook = require('./');

let livelook = new LiveLook({
    username: 'toadtripler',
    password: 'will triple toads',
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
        //livelook.fileSearch('the grouch');
        //console.log(livelook.tickers);
    }, 5000);

    /*let res = livelook.search('kurt vile', 5000);
    let tracks = [];
    res.on('track', track => {
        tracks.push(track);
        track.fileStream().pipe(fs.createWriteStream(track.file));
    });
    res.on('end', () => { console.log('finished searching', tracks);*/

    /*livelook.joinRoom('nicotine', (err, room) => {
        if (err) {
            return console.error(err);
        }

        console.log('joined room!', room);
    });*/
});
