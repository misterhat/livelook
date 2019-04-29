// handle packet construction and reading
// http://www.museek-plus.org/wiki/SoulseekProtocol#Packing

const Uint64LE = require('int64-buffer').Uint64LE;

class Message {
    constructor(buffer) {
        if (buffer) {
            this.data = buffer;
            this.write = false;
        } else {
            this.data = Buffer.alloc(0);
            this.write = true;
        }

        this.pointer = 0;
    }

    int8(val) {
        return this.write ? this.write8(val) : this.read8();
    }

    int32(val) {
        return this.write ? this.write32(val) : this.read32();
    }

    sInt32(val) {
        return this.write ? this.writeS32(val) : this.readS32();
    }

    int64(val) {
        return this.write ? this.write64(val) : this.read64();
    }

    str(val) {
        return this.write ? this.writeStr(val) : this.readStr();
    }

    rawHexStr(val) {
        return this.write ? this.writeRawHexStr(val) : this.readRawHexStr(val);
    }

    ipAddr(val) {
        return this.write ? this.writeIpAddr(val) : this.readIpAddr();
    }

    size() {
        return this.data.length;
    }

    seek(val) {
        this.pointer += val;
    }

    write8(val) {
        let b = Buffer.alloc(1);
        b.writeUInt8(val, 0);
        this.data = Buffer.concat([this.data, b]);
        this.pointer += 1;
        return this;
    }

    write32(val) {
        let b = Buffer.alloc(4);
        b.writeUInt32LE(val, 0);
        this.data = Buffer.concat([this.data, b]);
        this.pointer += 4;
        return this;
    }

    writeS32(val) {
        let b = Buffer.alloc(4);
        b.writeInt32LE(val, 0);
        this.data = Buffer.concat([this.data, b]);
        this.pointer += 4;
        return this;
    }

    write64(val) {
        let b = Uint64LE(val).toBuffer();
        this.data = Buffer.concat([this.data, b]);
        this.pointer += 8;
        return this;
    }

    writeStr(val) {
        // convert to buff
        let b = Buffer.from(val, 'utf8');
        let s = Buffer.alloc(4);
        s.writeUInt32LE(b.length, 0);

        // write length
        b = Buffer.concat([s, b]);

        // write text
        this.data = Buffer.concat([this.data, b]);

        this.pointer += b.length;

        return this;
    }

    writeRawHexStr(val) {
        let b = Buffer.from(val, 'hex');
        this.data = Buffer.concat([this.data, b]);
        this.pointer += b.length;
        return this;
    }

    writeBuffer(buff) {
        this.data = Buffer.concat([this.data, buff]);
        this.pointer += buff.length;
        return this;
    }

    writeIpAddr(ip) {
        if (!Array.isArray(ip)) {
            ip = ip.split('.');
        }

        ip.forEach(num => this.int8(num));
    }

    read8() {
        let val = this.data.readUInt8(this.pointer);
        this.pointer += 1;
        return val;
    }

    read32() {
        let val = this.data.readUInt32LE(this.pointer);
        this.pointer += 4;
        return val;
    }

    readS32() {
        let val = this.data.readInt32LE(this.pointer);
        this.pointer += 4;
        return val;
    }

    read64() {
        let val = Uint64LE(this.data.slice(this.pointer, this.pointer + 8));
        this.pointer += 8;
        return val;
    }

    readStr() {
        let size = this.data.readUInt32LE(this.pointer);
        this.pointer += 4;

        let str = this.data.toString('utf8', this.pointer, this.pointer + size);
        this.pointer += size;

        return str;
    }

    readRawHexStr(size) {
        let str = this.data.toString('hex', this.pointer, this.pointer + size);
        this.pointer += size;
        return str;
    }

    readIpAddr() {
        let ip = [];

        for (let i = 0; i < 4; i += 1) {
            ip.push(this.read8());
        }

        return ip;
    }

    getBuff() {
        const b = Buffer.alloc(4);
        b.writeUInt32LE(this.data.length, 0);
        this.data = Buffer.concat([b, this.data]);
        this.write = false;
        return this.data;
    }
}

module.exports = Message;
