// client -> peer packet factories

const Message = require('./index');
const encodeList = require('./encode-list');

module.exports = {
    pierceFirewall: token => new Message().int8(0).int32(token),
    peerInit: (username, cType, token) => {
        return new Message().int8(1).str(username).str(cType).int32(token)
    },
    // request a list of files
    getShareFileList: () => new Message().int32(4),
    // respond with a list of files
    sharedFileList: fileList => {
        let msg = new Message().int32(5);
        encodeList.shares(msg, fileList);
        return msg;
    },
    // send this to the peer when we search for something
    fileSearchRequest: (token, query) => {
        return new Message().int32(8).int32(token).str(query);
    },
    fileSearchResult: args => {
        let msg = new Message().str(args.user).int32(args.token);
        encodeList.files(msg, args.fileList);
        msg.int8(args.slotsFree).int32(args.speed).int64(args.queueSize);
        return new Message().int32(9).writeBuffer(zlib.deflateSync(msg.data));
    },
    userInfoRequest: () => new Message().int32(15),
    userInfoReply: args => {
        let msg = new Message().int32(16).str(args.description);

        if (args.picture) {
            msg.int8(true).file(args.picture);
        } else {
            msg.int8(false);
        }

        msg.int32(args.uploadSlots).int32(args.queueSize).int8(args.slotsFree);
        // who we accept uploads from
        msg.int32(args.uploadsFrom);

        return msg;
    },
    messageAcked: () => new Message().int32(23),
    folderContentsRequest: folders => {
        folders = Array.isArray(folders) ? folders : [ folders ];
        let msg = new Message().int32(36).int32(folders.length);
        folders.forEach(folder => msg.string(folder));
        return msg;
    },
    folderContentsReply: fileList => {
        let msg = new Message().int32(37);
        encodeList.shares(msg, fileList);
        return msg;
    },
    transferRequest: (upload, token, file, size) => {
        let msg = new Message().int32(40);
        msg.int32(+upload); // direction 1 for upload
        msg.int32(token).str(file);

        if (upload) {
            msg.int64(size);
        }

        return msg;
    },
    transferResponse: (token, allowed, size) => {
        let msg = new Message().int32(41).int32(token);

        if (allowed) {
            msg.int8(true).int64(size);
        } else {
            msg.int8(false).str(size); // reason
        }

        return msg;
    },
    queueUpload: file => new Message().int32(43).str(file),
    placeInQueue: (file, place) => {
        return new Message().int32(44).str(file).int32(place);
    },
    uploadFailed: file => new Message().int32(46).str(file),
    queueFailed: (file, reason) => {
        return new Message().int32(50).str(file).str(reason);
    },
    // TODO may not need this
    placeInQueueRequest: file => new Message().int32(51).str(file)
};
