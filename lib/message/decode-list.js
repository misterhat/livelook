const Message = require('./index');
const zlib = require('zlib');

let globalI = 0;

function decodeFiles(packet) {
    globalI += 1;
    let files = [];

    let fileCount = packet.int32();

    for (let i = 0; i < fileCount; i += 1) {
        let unused = packet.int8();

        let file = {
            name: packet.str(),
            size: packet.int64(),
            extension: packet.str()
        };

        let attrs = [];
        let attrCount = packet.int32();

        for (let j = 0; j < attrCount; j += 1) {
            packet.int32(); // position in attribute
            attrs.push(packet.int32());
        }

        // bitrate is always first
        if (attrs.length) {
            file.bitrate = attrs[0];
        }

        if (attrs.length === 3) {
            // sometimes the vbr indicator is in third position
            if (attrs[2] === 0 || attrs[2] === 1) {
                file.vbr = attrs[2] === 1;
                file.duration = attrs[1];
            // sometimes the vbr indicator is in second position
            } else if (attrs[1] === 0 || attrs[1] === 1) {
                files.vbr = attrs[1] === 1;
                file.duration = attrs[2];
            }
        } else if (attrs.length === 2) {
            // sometimes the vbr indicator is in second position
            if (attrs[1] === 0 || attrs[1] === 1) {
                // if it's a vbr file we can't deduce the length
                file.vbr = attrs[1];
                // if it's a constant bitrate we can deduce the length.
                if (file.vbr) {
                    // dividing the file size by the bitrate in bytes should
                    // give us a good enough approximation
                    file.duration = file.size / (file.bitrate / 8 * 1000);
                }
            // sometimes the bitrate is in first position and the length in
            // second position
            } else {
                file.duration = attrs[1];
            }
        }

        files.push(file);
    }

    return files;
}

function decodeShares(packet) {
   let dirs = {};

   let unzipped = packet.data.slice(packet.pointer, packet.data.length);
   // TODO we have to do this with async somehow
   unzipped = new Message(zlib.inflateSync(unzipped));

   let dirCount = unzipped.int32();
   for (let i = 0; i < dirCount; i += 1) {
       let dirName = unzipped.str();
       dirs[dirName] = decodeFiles(unzipped);
   }

   return dirs;
}

module.exports.files = decodeFiles;
module.exports.shares = decodeShares;
