const LiveLook = require('./');

let livelook = new LiveLook({
    username: 'toadtripler',
    password: 'thats three toads',
    sharedFolder: './mp3s',
    description: 'not responsible for toad-related mutations'
});

livelook.login((err, res) => {
    if (err) {
        return console.error(err);
    } else if (!res.success) {
        return console.log('invalid password lol');
    }

    console.log('logged in!');
});
