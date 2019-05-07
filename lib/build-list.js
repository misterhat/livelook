// create a fileList object for ./messages/file-list
// pass in a directory and the function will walk through it and build a POJO
// http://www.museek-plus.org/wiki/SoulseekProtocol#PeerCode5

const async = require('async');
const fs = require('fs');
const mm = require('music-metadata');
const path = require('path');
const rr = require('recursive-readdir');

function getMetaData(file, done) {
    let found = false;

    console.log('trying to get meta data for file', file);
    fs.stat(file, (err, stats) => {
        let populated = { file };
        console.log(err, stats);

        if (err) {
            return done(err);
        }

        populated.size = stats.size;

        mm.parseFile(file)
            .then(metadata => {
                if (found) {
                    return;
                }

                found = true;

                let vbr = metadata.format.codecProfile;
                vbr = vbr ? /v/i.test(vbr) : false;

                populated.bitrate = Math.floor(metadata.format.bitrate / 1000);
                populated.duration = Math.floor(metadata.format.duration);
                populated.vbr = vbr;
                done(null, populated);
            })
            .catch(err => {
                console.log('meta data got err', err);
                // ignoring because this is likely on a non-media file, and not
                // fatal
                if (!found) {
                    done(null, populated);
                }
            });
    });
}

// absolute attribute is enabled for search results. if false, returns an object
// keys representing directories containing arrays of files. otherwise just
// returns the array of files
function buildFileList(files, absolute = true, done) {
    async.mapSeries(files, getMetaData, (err, files) => {
        if (err) {
            return done(err);
        }

        let fileList;

        if (absolute) {
            fileList = [];

            for (const file of files) {
                const fileExt = path.extname(file.file).slice(1);

                fileList.push({
                    file: file.file,
                    size: file.size,
                    extension: fileExt,
                    bitrate: file.bitrate,
                    duration: file.duration,
                    vbr: file.vbr
                });
            }
        } else {
            fileList = {};

            for (const file of files) {
                const fileDir = path.dirname(file.file);
                const fileName = path.basename(file.file);
                const fileExt = path.extname(file.file).slice(1);

                if (!fileList[fileDir]) {
                    fileList[fileDir] = [];
                }

                fileList[fileDir].push({
                    file: fileName,
                    size: file.size,
                    extension: fileExt,
                    bitrate: file.bitrate,
                    duration: file.duration,
                    vbr: file.vbr
                });
            }
        }

        done(null, fileList);
    });
}

function buildShareList(dir, done) {
    rr(dir, (err, files) => {
        if (err) {
            return done(err);
        }

        buildFileList(files, false, done);
    });
}

module.exports.metaData = getMetaData;
module.exports.files = buildFileList;
module.exports.shares = buildShareList;
