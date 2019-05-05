# livelook
<img align="left" width="128" height="128" src="./livelook.svg">

a [soulseek](https://en.wikipedia.org/wiki/Soulseek)
client written in javascript. supports:
* [nat pmp](https://en.wikipedia.org/wiki/NAT_Port_Mapping_Protocol)
port-forwarding
* chat rooms and private messages (including direct connections)
* browsing user's files
* searching the network's files
* downloading and uploading with automatically updating share list

i mainly tested this with nicotine-plus, but it does also work with soulseekqt
as well.

<div style="clear: both;">&nbsp;</div>

## example
```javascript
const LiveLook = require('./');

let livelook = new LiveLook({
    username: 'toadtripler',
    password: 'not my password',
    sharedFolder: './mp3s',
    autojoin: [ 'nicotine' ]
});

livelook.on('error', console.error);

livelook.login((err, res) => {
    if (err || !res.success) {
        return console.log('login failed');
    }

    livelook.on('sayChatroom', msg => {
        console.log(`[${msg.room}] <${msg.username}> ${msg.message}`);
    });

    livelook.on('messageUser', msg => {
        console.log(`<${msg.username}> ${msg.message}`);
        livelook.messageUser(msg.username, 'hey i\'m a bot!');
    });
});
```
## install

	$ npm install --save livelook

## api
### new LiveLook(args)
create a new `livelook` instance.

```javascript
// args
{
    username: '',
    password: '',
    server: 'server.slsknet.org',
    port: 2242, // port for server above, NOT the port we listen on
    waitPort: 2234, // port for peer server. will retry multiple options if fail
    sharedFolder: './mp3s',
    downloadFolder: './downloads',
    description: 'user biography',
    autojoin: [ 'chatrooms', 'joined', 'automatically' ],
    maxPeers: 100,
    uploadSlots: 2, // maximum uploads allowed at one time
    uploadThrottle: 56 * 1024, // speed to throttle uploads in bytes
    downloadThrottle: 56 * 1024
}
```

### livelook.init([done])
initialize our share list and connect to the soulseek server. you don't need to
call this if you just use login below.

### livelook.login([username, password, done])
login to the soulseek server, and initialize our peer server if it isn't
already. username and password are optional if the instance has them.

### livelook.refreshShareList([done])
re-scan `livelook.sharedFolder` and repopulate `livelook.shareList`. this is
what other users see when they browse us, or when we respond to searches.

### livelook.sayChatroom(room, message)
send a message to a chatroom.

### livelook.leaveChatroom(room)
leave a chatroom and stop receiving messages from it.

### livelook.joinRoom(room)
join a chatroom and start accepting messages from it.

### livelook.messageUser(username, message)
send a private message to a specific user.

### livelook.setStatus(status)
set our online/away status.

`status` can be a `Number` (1 for away, 2 for online), `'away'` or `'online'`.

### livelook.refreshUploadSpeed([done])
re-calculate our upload speed from [speedtest.net](https://www.speedtest.net/).

### livelook.getPeerAddress(username, done)
get a peer's ip address and port based on their username. done returns null if
no user is found, not an error.

### livelook.connectToPeerUsername(username, done)
get a peer connection based on their username. this relies on using soulseek
server as an intermediate to tell them to connect to us when we're unable
to connect to them.

## donate
[donate to keep the central server alive!](https://www.slsknet.org/donate.php)

## see also

* [museek-plus](https://github.com/eLvErDe/museek-plus) by @eLvErDe
* [nicotine-plus](https://github.com/Nicotine-Plus/nicotine-plus)
* [slsk-client](https://github.com/f-hj/slsk-client) by @f-hj.

## license
Copyright (C) 2019  Zorian Medwid

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see http://www.gnu.org/licenses/.

**You may not distribute this program without offering the source code. Hosting
a web service that utilizes livelook is distrubtion.**
