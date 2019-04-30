const natpmp = require('nat-pmp');
const network = require('network');

module.exports = function (done) {
    network.get_gateway_ip((err, gateway) => {
        if (err) {
            this.emit('error', err);
            return done(err);
        }

        let natpmpClient = natpmp.connect(gateway);
        let natpmpTimeout = setTimeout(() => {
            let err = new Error(
                'unable to connect to nat-pmp. try enabling upnp or ' +
                `forward port ${this.port} at http://${gateway}`
            );
            this.emit('error', err);
            done(err);
        }, 5000);

        natpmpClient.portMapping({
            private: this.port,
            public: this.port,
            ttl: 100
        }, (err, res) => {
            clearTimeout(natpmpTimeout);

            if (!err) {
                this.pmp = res;
                this.emit('waitPort', this.pmp.public);
            }

            done(err);
        });
    });
};
