// confirm our peer server is accepting outside connections

const http = require('http');

module.exports = (port, done) => {
    const url = `http://tools.slsknet.org/porttest.php?port=${port}`;
    let finished = false;

    http.get(url, res => {
        let body = '';

        res.on('data', data => body += data);

        res.on('end', () => {
            body = body.toString();

            if (!finished) {
                finished = true;
                done(null, body.indexOf(`Port: ${port}/tcp open`) > -1);
            }
        });
    }).on('error', (err) => {
        if (err && !finished) {
            finished = true;
            done(err);
        }
    });
};
