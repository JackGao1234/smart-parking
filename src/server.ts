import crypto from 'node:crypto';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import os from 'node:os';
import { createApp } from './app.js';

const PORT = Number(process.env.PORT ?? 3000);
const LAN_OPEN_PORT = 26822;
const app = createApp();

interface LanInterfaceInfo {
  name: string;
  address: string;
}

function getLanInterfaces(): LanInterfaceInfo[] {
  const list: LanInterfaceInfo[] = [];
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] ?? []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        list.push({ name, address: iface.address });
      }
    }
  }
  return list;
}

function generateX509v3Cert(lanIps: string[]): { key: string; cert: string } {
  const derLen = (len: number) => {
    if (len < 128) return Buffer.from([len]);
    const hex = len.toString(16).padStart(len > 255 ? 4 : 2, '0');
    const bytes = Buffer.from(hex, 'hex');
    return Buffer.concat([Buffer.from([0x80 | bytes.length]), bytes]);
  };
  const tag = (t: number, ...items: Buffer[]) => {
    const body = Buffer.concat(items);
    return Buffer.concat([Buffer.from([t]), derLen(body.length), body]);
  };
  const seq = (...items: Buffer[]) => tag(0x30, ...items);
  const set = (...items: Buffer[]) => tag(0x31, ...items);
  const oct = (...items: Buffer[]) => tag(0x04, ...items);
  const int = (buf: Buffer) => {
    const b = buf[0] & 0x80 ? Buffer.concat([Buffer.from([0x00]), buf]) : buf;
    return tag(0x02, b);
  };
  const oid = (bytes: number[]) =>
    Buffer.concat([Buffer.from([0x06, bytes.length]), Buffer.from(bytes)]);
  const utf8 = (str: string) => tag(0x0c, Buffer.from(str, 'utf8'));
  const utctime = (str: string) => tag(0x17, Buffer.from(str, 'ascii'));
  const bitstr = (buf: Buffer, unusedBits = 0) =>
    tag(0x03, Buffer.from([unusedBits]), buf);

  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048
  });

  const spki = publicKey.export({ type: 'spki', format: 'der' }) as Buffer;
  const sigAlg = seq(
    oid([0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x0b]),
    Buffer.from([0x05, 0x00])
  );
  const name = seq(set(seq(oid([0x55, 0x04, 0x03]), utf8('SmartParkingFinder'))));
  const validity = seq(utctime('260101000000Z'), utctime('270101000000Z'));
  const version = tag(0xa0, int(Buffer.from([0x02])));
  const serial = int(crypto.randomBytes(12));

  const extBasicConstraints = seq(oid([0x55, 0x1d, 0x13]), oct(seq()));
  const extKeyUsage = seq(
    oid([0x55, 0x1d, 0x0f]),
    Buffer.from([0x01, 0x01, 0xff]),
    oct(bitstr(Buffer.from([0xa0]), 5))
  );
  const extExtKeyUsage = seq(
    oid([0x55, 0x1d, 0x25]),
    oct(seq(oid([0x2b, 0x06, 0x01, 0x05, 0x05, 0x07, 0x03, 0x01])))
  );

  const allIps = Array.from(new Set(['127.0.0.1', ...lanIps]));
  const sanEntries = [
    tag(0x82, Buffer.from('localhost', 'ascii')),
    ...allIps.map((ip) => tag(0x87, Buffer.from(ip.split('.').map(Number))))
  ];
  const extSan = seq(oid([0x55, 0x1d, 0x11]), oct(seq(...sanEntries)));
  const extensions = tag(
    0xa3,
    seq(extBasicConstraints, extKeyUsage, extExtKeyUsage, extSan)
  );

  const tbs = seq(version, serial, sigAlg, name, validity, name, spki, extensions);
  const sig = crypto.sign('sha256', tbs, privateKey);
  const certDer = seq(tbs, sigAlg, bitstr(sig));
  const lines = certDer.toString('base64').match(/.{1,64}/g) ?? [];
  const certPem = `-----BEGIN CERTIFICATE-----\n${lines.join('\n')}\n-----END CERTIFICATE-----\n`;
  const keyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;

  return { key: keyPem, cert: certPem };
}

const lanInterfaces = getLanInterfaces();
const lanIps = lanInterfaces.map((i) => i.address);
const creds = generateX509v3Cert(lanIps);

const httpServer = http.createServer(app);
const httpsServer = https.createServer(creds, app);

function createMuxServer() {
  return net.createServer((socket) => {
    socket.once('readable', () => {
      const chunk: Buffer | null = socket.read(1);
      if (!chunk) return;
      socket.unshift(chunk);
      if (chunk[0] === 0x16) {
        httpsServer.emit('connection', socket);
      } else {
        httpServer.emit('connection', socket);
      }
    });
  });
}

createMuxServer().listen(PORT, '0.0.0.0', () => {
  console.log(`============================================================`);
  console.log(`🚗 智慧找車位與一鍵導航服務已啟動！`);
  console.log(`💻 電腦本機開啟: http://localhost:${PORT}`);
  for (const item of lanInterfaces) {
    const lanMux = createMuxServer();
    lanMux.on('error', () => {});
    lanMux.listen(LAN_OPEN_PORT, item.address, () => {
      console.log(
        `📱 Pixel 手機 (防火牆已開通埠 ${LAN_OPEN_PORT}): https://${item.address}:${LAN_OPEN_PORT}`
      );
      console.log(
        `📱 Pixel 手機 (HTTP 備用埠 ${LAN_OPEN_PORT}):  http://${item.address}:${LAN_OPEN_PORT}`
      );
    });
  }
  console.log(`============================================================`);
});
