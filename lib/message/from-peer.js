// peer -> client packet decoders
const decodeList = require('./decode-list');
const zlib = require('zlib');

module.exports = {
    1: msg => ({
        type: 'peerInit',
        username: msg.str(),
        type: msg.str(),
        token: msg.rawHexStr(4)
    }),
    4: msg => ({ type: 'getShareFileList' }),
    5: msg => ({ type: 'sharedFileList', fileList: decodeList.shares(msg) }),
    8: msg => ({
        type: 'fileSearchRequest',
        token: msg.rawHexStr(4),
        query: msg.str()
    }),
    9: msg => {
        let unzipped = msg.data.slice(msg.pointer, msg.data.length);
        // TODO move this to the decoder and make this async
        unzipped = new Message(zlib.inflateSync(unzipped));

        return {
            username: unzipped.str(),
            token: msg.rawHexStr(4),
            fileList: decodeList.files(unzipped),
            slotsFree: !!msg.int8(),
            speed: msg.int32(),
            queueSize: msg.int64()
        };
    },
    15: () => ({ type: 'userInfoRequest' }),
    16: msg => {
        let decoded = {
            type: 'userInfoReply',
            description: msg.str()
        };

        let hasPicture = msg.int8();

        if (hasPicture) {
            // TODO convert this to a buffer probably
            decoded.picture = msg.str();
        }

        decoded.totalUpload = msg.int32();
        decoded.queueSize = msg.int32();
        decoded.slotsFree = msg.int8();

        return decoded;
    },
    36: msg => {
        let decoded = {
            type: 'folderContentsRequest',
            files: []
        };

        let fileCount = msg.int32();
        for (let i = 0; i < fileCount; i += 1) {
            decoded.files.push(msg.str());
        }

        return decoded;
    },
    37: msg => ({
        type: 'folderContentsResponse',
        fileList: decodeList.shares(msg)
    }),
    40: msg => {
        let decoded = {
            type: 'transferRequest',
            direction: int32(),
            token: msg.rawHexStr(4),
            file: msg.str()
        };

        if (decoded.direction) {
            decoded.size = msg.int64();
        }

        return decoded;
    },
    41: msg => {
        let decoded = {
            type: 'transferResponse',
            token: msg.rawHexStr(4),
            allowed: !!msg.int8()
        };

        if (decoded.allowed) {
            decoded.size = msg.int64();
        } else {
            decoded.reason = msg.str();
        }

        return decoded;
    },
    43: msg => ({ type: 'queueUpload', file: msg.str() }),
    44: msg => ({ type: 'placeInQueue', file: msg.str(), place: msg.int32() }),
    46: msg => ({ type: 'uploadFailed', file: msg.str() }),
    50: msg => ({ type: 'queueFailed', file: msg.str(), reason: msg.str() }),
    51: msg => ({ type: 'placeInQueueRequest', file: msg.str() }),
    52: () => ({ type: 'uploadQueueNotification' })
};
