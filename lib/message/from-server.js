// server -> client packet decoders
const decodeRoom = require('./decode-room');

module.exports = {
    1: msg => {
        let decoded = { type: 'login', success: msg.int8() };
        decoded[decoded.success ? 'motd' : 'reason'] = msg.str();
        return decoded;
    },
    3: msg => ({
        type: 'getPeerAddress',
        username: msg.str(),
        ip: msg.ipAddr(),
        port: msg.int32()
    }),
    5: msg => {
        let decoded = {
            type: 'addUser',
            username: msg.str(),
            exists: msg.int8()
        };

        if (decoded.exists) {
            decoded.status = msg.int32();
            decoded.speed = msg.int32();
            // TODO not sure what this is
            decoded.downloadNum = msg.int32();
            decoded.files = msg.int32();
            decoded.folders = msg.int32();
            // may not be implemented
            try {
                decoded.country = msg.str();
            } catch (e) {
                // discard
            }
        }

        return decoded;
    },
    7: msg => ({
        type: 'getUserStatus',
        username: msg.str(),
        status: msg.int32(),
        privileged: msg.int8()
    }),
    13: msg => ({
        type: 'sayChatroom',
        room: msg.str(),
        username: msg.str(),
        message: msg.str()
    }),
    14: decodeRoom.join,
    15: msg => ({
        type: 'leaveRoom',
        room: msg.str()
    }),
    16: msg => ({
        type: 'userJoinedRoom',
        room: msg.str(),
        username: msg.str(),
        status: msg.int32(),
        speed: msg.int32(),
        downloadNum: msg.int64(),
        files: msg.int32(),
        folders: msg.int32(),
        slotsFree: msg.int32(),
        country: msg.str()
    }),
    17: msg => ({
        type: 'userLeftRoom',
        room: msg.str(),
        username: msg.str()
    }),
    18: msg => ({
        type: 'connectToPeer',
        username: msg.str(),
        type: msg.str(),
        ip: msg.ipAddr(),
        port: msg.int32(),
        token: msg.rawHexStr(4),
        privileged: msg.int8()
    }),
    22: msg => {
        let decoded = {
            type: 'messageUser',
            id: msg.int32(),
            timestamp: new Date(msg.int32() * 1000),
            username: msg.str(),
            message: msg.str()
        };

        try {
            decoded.isAdmin = !!msg.int8();
        } catch (e) {
            decoded.isAdmin = false;
        }

        return decoded;
    },
    26: msg => {
        return {
            type: 'fileSearch',
            username: msg.str(),
            query: msg.str()
        };
    },
    32: () => ({ type: 'ping' }),
    // this is apparently deprecated, but it's still being sent to us
    36: msg => ({
        type: 'getUserStats',
        username: msg.str(),
        speed: msg.int32(),
        downloadNum: msg.int64(),
        files: msg.int32(),
        directories: msg.int32()
    }),
    41: () => ({ type: 'relog' }),
    54: msg => {
        let decoded = {
            type: 'globalRecommendations',
            recommendations: [],
            unrecommendations: []
        };

        let recCount = msg.int32();
        for (let i = 0; i < recCount; i += 1) {
            decoded.recommendations.push({
                name: msg.str(),
                count: msg.int32()
            });
        }

        let unrecCount = msg.int32();
        for (let i = 0; i < unrecCount; i += 1) {
            decoded.unrecommendations.push({
                name: msg.str(),
                count: msg.int32()
            });
        }

        return decoded;
    },
    57: msg => {
        let decoded = { type: 'userInterests', liked: [], hated: [] };

        let likedCount = msg.int32();
        for (let i = 0; i < likedCount; i += 1) {
            decoded.liked.push(msg.str());
        }

        let hatedCount = msg.int32();
        for (let i = 0; i < hatedCount; i += 1) {
            decoded.hated.push(msg.str());
        }

        return decoded;
    },
    64: decodeRoom.list,
    69: msg => {
        let decoded = { type: 'privilegedUsers', users: [] };

        let userCount = msg.int32();
        for (let i = 0; i < userCount; i += 1) {
            decoded.users.push(msg.str());
        }

        return decoded;
    },
    83: msg => ({ type: 'parentMinSpeed', minSpeed: msg.int32() }),
    84: msg => ({ type: 'parentSpeedRatio', ratio: msg.int32() }),
    91: msg => ({ type: 'addToPrivileged', username: msg.str() }),
    92: msg => ({ type: 'checkPrivileges', timeLeft: msg.int32() }),
    93: msg => ({
        type: 'searchRequest',
        distributedCode: msg.int8(),
        unknown: msg.int32(),
        username: msg.str(),
        token: msg.rawHexStr(4),
        query: msg.str()
    }),
    102: msg => {
        let decoded = { type: 'netInfo', parents: [] };

        let parentCount = msg.int32();
        for (let i = 0; i < i < parentCount; i += 1) {
            decoded.parents.push({
                username: msg.str(),
                ip: msg.ipAddr(),
                port: msg.int32()
            });
        }

        return decoded;
    },
    104: msg => ({ type: 'wishlistInterval', interval: msg.int32() }),
    110: msg => {
        let decoded = { type: 'similarUsers', users: [] };

        let userCount = msg.int32();
        for (let i = 0; i < userCount; i += 1) {
            decoded.users.push({
                username: msg.str(),
                status: msg.int32()
            });
        }

        return decoded;
    },
    111: msg => {
        let decoded = {
            type: 'itemRecommendations',
            item: msg.str(),
            recommendations: []
        };

        let recCount = msg.int32();
        for (let i = 0; i < recCount; i += 1) {
            decoded.recommendations.push({
                name: msg.str(),
                count: msg.int32()
            });
        }

        return decoded;
    },
    112: msg => {
        let decoded = {
            type: 'itemSimilarUsers',
            item: msg.str(),
            users: []
        };

        let userCount = msg.int32();
        for (let i = 0; i < userCount; i += 1) {
            decoded.users.push({ username: msg.str(), count: msg.int32() });
        }

        return decoded;
    },
    113: msg => {
        let decoded = {
            type: 'roomTickerState',
            room: msg.str(),
            users: {}
        };

        let userCount = msg.int32();
        for (let i = 0; i < userCount; i += 1) {
            // TODO make sure this isn't reversed - this is how nicotine does it
            decoded.users[msg.str()] = msg.str();
        }

        return decoded;
    },
    114: msg => ({
        type: 'roomTickerAdd',
        room: msg.str(),
        username: msg.str(),
        ticker: msg.str()
    }),
    115: msg => ({
        type: 'roomTickerRemove',
        room: msg.str(),
        username: msg.str(),
    }),
    125: msg => ({ type: 'ackNotifyPrivileges', token: msg.rawHexStr(4) }),
    // members we can alter in a private room
    133: msg => {
        let decoded = {
            type: 'privateRoomUsers',
            users: []
        };

        let userCount = msg.int32();
        for (let i = 0; i < userCount; i += 1) {
            decoded.users.push(msg.str());
        }

        return decoded;
    },
    134: msg => ({
        type: 'privateRoomAddUser',
        room: msg.str(),
        username: msg.str()
    }),
    135: msg => ({
        type: 'privateRoomRemoveUser',
        room: msg.str(),
        username: msg.str()
    }),
    139: msg => ({ type: 'privateRoomAdded', room: msg.str() }),
    140: msg => ({ type: 'privateRoomRemoved', room: msg.str() }),
    141: msg => ({ type: 'privateRoomToggle', enable: msg.int8() }),
    142: msg => ({ type: 'changePassword', password: msg.str() }),
    143: msg => ({
        type: 'privateRoomAddOperator',
        room: msg.str(),
        username: msg.str()
    }),
    144: msg => ({
        type: 'privateRoomRemoveOperator',
        room: msg.str(),
        username: msg.str()
    }),
    145: msg => ({
        type: 'privateRoomOperatorAdded',
        room: msg.str()
    }),
    146: msg => ({
        type: 'privateRoomOperatorRemoved',
        room: msg.str()
    }),
    148: msg => {
        let decoded = {
            type: 'privateRoomOwned',
            room: msg.str(),
            operators: []
        };

        let opCount = msg.int32();
        for (let i = 0; i < 0; i += 1) {
            decoded.operators.push(msg.str());
        }

        return decoded;
    },
    152: msg => ({
        type: 'publicChat',
        room: msg.str(),
        username: msg.str(),
        message: msg.str()
    }),
    1001: msg => ({
        type: 'cantConnectToPeer',
        token: msg.rawHexStr(4),
        username: msg.str()
    })
};
