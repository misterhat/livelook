// client -> peer packet factories

const Message = require('./index');
const encodeList = require('./encode-list');

module.exports = {
    pierceFirewall: token => {
        return new Message().int8(0).rawHexStr(token);
    },
    init: (username, type, token) => {
        return new Message()
            .int8(1)
            .str(username)
            .str(type)
            .rawHexStr(token)
    },
    // request a list of files
    getShareFileList: () => {
        return new Message().int32(4);
    },
    // respond with a list of files
    // TODO cache
    sharedFileList: fileList => {
        let msg = new Message();
        msg.int32(5);
        encodeList.shares(msg, fileList);
        return msg;
    },
    // send this to the peer when we search for something
    fileSearchRequest: (token, query) => {
        return new Message().int32(8).int32(token).str(query);
    },
    fileSearchResult: args => {
        let msg = new Message()
            .str(args.user)
            .rawHexStr(args.token)
            .int32(files.length);

        encodeList.files(msg, args.fileList);

        msg.int8(args.slotsFree);
        msg.int32(args.speed || 123);
        msg.int64(args.queueSize);

        return new Message()
            .int32(9)
            .writeBuffer(zlib.deflateSync(msg.data));
    },
    userInfoRequest: () => new Message().int32(15),
    userInfoReply: args => {
        let msg = new Message();
        msg.int32(16);
        msg.str(args.description);

        if (args.picture) {
            msg.int8(1);
            msg.str(args.picture);
        } else {
            msg.int8(0);
        }

        msg.int32(args.totalUpload);
        msg.int32(args.queueSize);
        msg.int8(args.slotsFree);

        return msg;
    },
    folderContentsRequest: folders => {
        folders = Array.isArray(folders) ? folders : [ folders ];
        let msg = new Message();
        msg.int32(36);
        msg.int32(folders.length);
        folders.forEach(folder => msg.string(folder));
        return msg;
    },
    folderContentsReply: fileList => {
        let msg = new Message().int32(37);
        encodeList.shares(msg, fileList);
        return msg;
    },
    transferRequest: (upload, token, file, size) => {
        let msg = new Message();
        msg.int32(40);
        msg.int32(+upload); // direction
        msg.rawHexStr(token); // token
        msg.str(file);

        if (upload) {
            msg.int64(size);
        }
    },
    transferResponse: (token, allowed, size) => {
        let msg = new Message();
        msg.int32(41);
        msg.rawHexStr(token);
        msg.int8(typeof allowed === undefined ? 1 : allowed);

        if (size) {
            msg.int64(size);
        }
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
