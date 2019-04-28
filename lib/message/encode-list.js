const Message = require('./index');
const zlib = require('zlib');

function encodeFiles(packet, fileList) {
    packet.int32(fileList.length);

    for (const file of fileList) {
        packet.int8(1);
        packet.str(file.file);
        packet.int64(file.size);
        packet.str(file.extension);

        let attrs = [];

        if (file.bitrate) {
            attrs.push(file.bitrate);

            if (file.duration) {
                attrs.push(file.duration);
                // don't push vbr flag unless we also have duration - deliberate
                attrs.push(file.vbr);
            }
        }

        packet.int32(attrs.length);
        attrs.forEach((attr, i) => {
            packet.int32(i);
            packet.int32(attr);
        });
    }
}

// http://www.museek-plus.org/wiki/SoulseekProtocol#PeerCode5
function encodeShares(packet, fileList) {
    let dirs = Object.keys(fileList);
    let compressed = new Message();

    compressed.int32(dirs.length);

    for (let dir of dirs) {
        compressed.str(dir);
        encodeFiles(compressed, fileList[dir]);
    }

    packet.writeBuffer(compressed);
}

module.exports.files = encodeFiles;
module.exports.shares = encodeShares;
