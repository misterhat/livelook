function decodeJoinRoom(msg) {
    let decoded = { type: 'joinRoom', room: msg.str(), users: [] };

    let userCount = msg.int32();
    for (let i = 0; i < userCount; i += 1) {
        decoded.users.push({ username: msg.str() });
    }

    // this should be the same...
    msg.int32();

    for (let i = 0; i < userCount; i += 1) {
        decoded.users[i].status = msg.int32();
    }

    msg.int32();

    for (let i = 0; i < userCount; i += 1) {
        decoded.users[i].speed = msg.int32();
        decoded.users[i].downloadNum = msg.int64();
        decoded.users[i].files = msg.int32();
        decoded.users[i].folders = msg.int32();
    }

    msg.int32();

    for (let i = 0; i < userCount; i += 1) {
        decoded.users[i].slotsFree = msg.int32();
    }

    msg.int32();

    for (let i = 0; i < userCount; i += 1) {
        decoded.users[i].country = msg.str();
    }

    let owner;

    try {
        owner = msg.str();
    } catch (e) {
        owner = null;
    }

    if (owner) {
        decoded.owner = owner;

        let operatorCount = msg.int32();
        for (let i = 0; i < operatorCount; i += 1) {
            let operator = msg.str();

            decoded.users = decoded.users.map(user => {
                if (user.username === operator) {
                    user.operator = true;
                }
            });
        }
    }
}

function decodeRoomChunk(msg) {
    let rooms = [];

    let roomCount = msg.int32();
    for (let i = 0; i < roomCount; i += 1) {
        rooms.push({ name: msg.str() });
    }

    msg.int32(); // user count

    for (let i = 0; i < roomCount; i += 1) {
        rooms[i].users = msg.int32();
    }

    return rooms;
}

function decodeRoomList(msg) {
    return {
        'public': decodeRoomChunk(msg),
        ownedPrivate: decodeRoomChunk(msg),
        'private': decodeRoomChunk(msg)
    };
}

module.exports.join = decodeJoinRoom;
module.exports.list = decodeRoomList;
