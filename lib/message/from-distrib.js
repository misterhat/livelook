module.exports = {
    0: msg => {
        let decoded = { type: 'ping' };

        if (msg.length >= 4) {
            decoded.something = msg.int32();
        }
    },
    3: msg => ({
        type: 'search',
        something: msg.int32(),
        username: msg.str(),
        token: msg.int32(),
        query: msg.str()
    }),
    4: msg => ({
        type: 'branchLevel',
        level: msg.int32()
    }),
    5: msg => ({
        type: 'branchRoot',
        root: msg.int32()
    }),
    7: msg => ({
        type: 'childDepth',
        depth: msg.int32()
    })
};
