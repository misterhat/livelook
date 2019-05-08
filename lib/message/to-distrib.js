const Message = require('./index');
const toPeer = require('./to-peer');

module.exports = {
    pierceFirewall: toPeer.pierceFirewall,
    peerInit: toPeer.peerInit,
    ping: something => {
        let msg = new Message().int8(0);

        if (something) {
            msg.int32(something);
        }

        return msg;
    },
    search: args => {
        var msg = new Message().int8(3).int32(args.something || 0);
        msg.str(args.username).int32(args.token).str(args.query);
        return msg;
    },
    branchLevel: level => new Message().int8(4).int32(level),
    branchRoot: root => new Message().int8(5).int32(root),
    childDepth: depth => new Message().int8(8).int32(depth)
};
