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

    fs.stat(file, (err, stats) => {
        if (err) {
            return done(err);
        }

        mm.parseFile(file)
            .then(metadata => {
                found = true;

                let vbr = metadata.format.codecProfile;
                vbr = vbr ? /v/i.test(vbr) : false;

                done(null, {
                    file,
                    size: stats.size,
                    bitrate: Math.floor(metadata.format.bitrate / 1000),
                    duration: Math.floor(metadata.format.duration),
                    vbr
                });
            })
            .catch(err => {
                // ignoring because this is likely on a non-media file, and not
                // fatal
                if (!found) {
                    done(null, { file });
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
                    vbr: file,vbr
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

// TODO filter old files from files
function buildShareList(dir, old = [], done) {
    rr(dir, (err, files) => {
        if (err) {
            return done(err);
        }

        buildFileList(files, false, done);
    });
}

module.exports.buildFileList = buildFileList;
module.exports.buildShareList = buildShareList;
