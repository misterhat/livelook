// client -> server packet factories

const Message = require('./index');
const crypto = require('crypto');

module.exports = {
    login: (username, password) => {
        let hash = crypto.createHash('md5').update(username + password);
        hash = hash.digest('hex');

        return new Message()
            .int32(1)
            .str(username)
            .str(password)
            .int32(157) // version
            .str(hash)
            .int32(17); // minor version?
    },
    setWaitPort: (port = 2234) => new Message().int32(2).int32(port),
    getPeerAddress: username => new Message().int32(3).str(username),
    addUser: username => new Message().int32(5).str(username),
    getUserStatus: username => new Message().int32(7).str(username),
    sayChatroom: (room, message) => {
        return new Message().int32(13).str(room).str(message);
    },
    joinRoom: room => new Message().int32(14).str(room),
    leaveRoom: room => new Message().int32(15).str(room),
    connectToPeer: (token, username, type) => {
        return new Message().int32(18).str(username).str(type);
    },
    messageUser: (username, message) => {
        return new Message().int32(22).str(username).str(message);
    },
    messageAcked: id => new Message().int32(23).int32(id),
    fileSearch: (token, query) => {
        return new Message()
            .int32(26)
            .rawHexStr(token)
            .str(query);
    },
    setStatus: online => new Message().int32(28).int32(online ? 2 : 1),
    ping: () => new Message().int32(32),
    sharedFoldersFiles: (folderCount, fileCount) => {
        return new Message().int32(35).int32(folderCount).int32(fileCount);
    },
    userSearch: (username, token, query) => {
        return new Message().int32(42).int32(token).str(query);
    },
    addThingILike: item => new Message().int32(51).str(item),
    removeThingILike: item => new Message().int32(52).str(item),
    recommendations: () => new Message().sInt32(54),
    globalRecommendations: () => new Message().sInt32(56),
    userInterests: username => new Message().int32(57).str(username),
    roomList: () => new Message().int32(57).str(username),
    privilegedUsers: () => new Message().int32(69),
    haveNoParent: haveParent => new Message().int32(71).int8(haveParent),
    parentIp: ip => new Message().int32(73).ipAddr(ip),
    checkPrivileges: () => new Message().int32(92),
    acceptChildren: accept => new Message().int32(100).int8(accept),
    wishlistSearch: (token, query) => {
        return new Message().int32(103).int32(token).str(query);
    },
    similarUsers: () => new Message().int32(110),
    itemRecommendations: item => new Message().sInt32(111).str(item),
    itemSimilarUsers: item => new Message().int32(112).str(item),
    roomTickerSet: (room, ticker) => {
        return new Message().int32(117).str(room).str(ticker);
    },
    addThingIHate: item => new Message().int32(118).str(item),
    removeThingIHate: item => new Message().int32(119).str(item),
    roomSearch: (room, token, query) => {
        return new Message().int32(120).int32(token).str(query);
    },
    sendUploadSpeed: speed => new Message().int32(121).int32(speed),
    // give (part) of your privileges to another user on the network
    givePrivileges: (username, days) => {
        return new Message().int32(123).str(username).int32(days);
    },
    notifyPrivileges: (token, username) => {
        return new Message().int32(124).int32(token).str(username);
    },
    ackNotifyPrivileges: () => new Message().int32(125),
    privateRoomAddUser: (room, username) => {
        return new Message().int32(134).str(room).str(username);
    },
    privateRoomRemoveUser: (room, username) => {
        return new Message().int32(135).str(room).str(username);
    },
    privateRoomDismember: room => new Message().int32(136).str(room),
    privateRoomDisown: room => new Message().int32(137).str(room),
    // send this when we want to enable or disable invitations to private rooms
    privateRoomToggle: enable => new Message().int32(141).str(enable),
    changePassword: password => new Message().int32(142).str(password),
    privateRoomAddOperator: (room, username) => {
        return new Message().int32(143).str(room).str(username);
    },
    privateRoomRemoveOperator: (room, username) => {
        return new Message().int32(144).str(room).str(username);
    },
    // broadcast a message to multiple users
    messageUsers: (usernames, message) => {
        let msg = new Message();
        msg.int32(149);
        msg.int32(usernames.length);
        usernames.forEach(username => msg.str(username));
        msg.str(message);
        return msg;
    },
    // ask the server to send us all public chats
    // ie every single line written in every public room
    askPublicChat: () => new Message().int32(150),
    stopPublicChat: () => new Message().int32(151),
    cantConnectToPeer: (token, username) => {
        return new Message().int32(1001).int32(token).str(username);
    }
};
