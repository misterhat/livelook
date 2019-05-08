// find a query in our sharelist

const path = require('path');

// format files into a flattened array with strings suitable for searching
function formatShareList(shareList) {
    let flattened = [];

    Object.keys(shareList).forEach(dir => {
        shareList[dir].forEach(file => {
            dir = dir.replace(/\//g, '\\');
            let formatted = dir + ' ';
            formatted += file.file.replace(path.extname(file.file), '');
            formatted = formatted.replace(/[\/\-_]/g, ' ');
            formatted = formatted.replace(/[^0-9a-z ]/gi, '').toLowerCase();
            flattened.push({ dir, file, formatted });
        });
    });

    return flattened;
}

function searchShareList(shareList, query, limit = 50) {
    query = query.toLowerCase().replace(/[\/\-_]/g, ' ').trim();
    query = query.replace(/[^0-9a-z ]/gi, '').toLowerCase();

    if (query.length < 3) {
        return [];
    }

    let found = [];
    let formatted = formatShareList(shareList);
    let terms = query.split(' ');

    // ok so it's not actually a pair anymore
    formatted.forEach(filePair => {
        let formatted = filePair.formatted;

        for (let term of terms) {
            if (formatted.indexOf(term) < 0) {
                return;
            }
        }

        found.push({
            file: filePair.dir + '\\' + filePair.file.file,
            size: filePair.file.size,
            extension: filePair.file.extension,
            bitrate: filePair.file.bitrate,
            duration: filePair.file.duration,
            vbr: filePair.file.vbr
        });
    });

    // TODO instead of slicing we should break a for loop
    return found.slice(0, limit);
}


module.exports.search = searchShareList;
