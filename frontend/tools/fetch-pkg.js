import fs from 'fs';
import path from 'path';
import https from 'https';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const NODE_MODULES = path.resolve(__dirname, '../node_modules');

const NPM_IP = '104.16.11.34';

function requestHttps(urlPath) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: NPM_IP,
      port: 443,
      path: urlPath,
      method: 'GET',
      headers: {
        Host: 'registry.npmjs.org',
        'User-Agent': 'node-fetch-pkg/1.0',
        Accept: 'application/json, application/octet-stream',
      },
      servername: 'registry.npmjs.org',
      rejectUnauthorized: false,
    };

    const req = https.request(options, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        let loc = res.headers.location;
        if (loc.startsWith('https://registry.npmjs.org')) {
          loc = loc.replace('https://registry.npmjs.org', '');
        }
        return resolve(requestHttps(loc));
      }

      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode} for ${urlPath}`));
        }
        resolve(Buffer.concat(chunks));
      });
    });

    req.on('error', reject);
    req.end();
  });
}

function extractTar(tarBuffer, targetDir) {
  let offset = 0;
  while (offset < tarBuffer.length - 512) {
    const header = tarBuffer.subarray(offset, offset + 512);
    // Check for null block (end of archive)
    if (header[0] === 0) break;

    let filename = header.toString('utf8', 0, 100).replace(/\0/g, '').trim();
    if (!filename) break;

    const sizeStr = header.toString('utf8', 124, 136).replace(/\0/g, '').trim();
    const size = parseInt(sizeStr, 8) || 0;
    const typeFlag = String.fromCharCode(header[156]);

    offset += 512;

    // npm tarballs prefix paths with 'package/'
    if (filename.startsWith('package/')) {
      filename = filename.slice('package/'.length);
    }

    if (filename) {
      const fullPath = path.join(targetDir, filename);

      if (typeFlag === '5' || filename.endsWith('/')) {
        // Directory
        fs.mkdirSync(fullPath, { recursive: true });
      } else {
        // Regular file
        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        const fileData = tarBuffer.subarray(offset, offset + size);
        fs.writeFileSync(fullPath, fileData);
      }
    }

    const padding = (512 - (size % 512)) % 512;
    offset += size + padding;
  }
}

export async function installPackage(pkgName, version = 'latest') {
  console.log(`Fetching metadata for ${pkgName}@${version}...`);
  const encodedName = pkgName.startsWith('@')
    ? `@${encodeURIComponent(pkgName.slice(1))}`
    : pkgName;
  
  const metaBuf = await requestHttps(`/${encodedName}/${version}`);
  const meta = JSON.parse(metaBuf.toString('utf8'));
  const tarballUrl = meta.dist?.tarball;
  if (!tarballUrl) {
    throw new Error(`No tarball found for ${pkgName}`);
  }

  const tarballPath = tarballUrl.replace('https://registry.npmjs.org', '');
  console.log(`Downloading tarball ${tarballPath}...`);
  const tgzBuf = await requestHttps(tarballPath);

  console.log(`Decompressing ${pkgName}...`);
  const tarBuf = zlib.gunzipSync(tgzBuf);

  const targetDir = path.join(NODE_MODULES, pkgName);
  console.log(`Extracting to ${targetDir}...`);
  fs.mkdirSync(targetDir, { recursive: true });
  extractTar(tarBuf, targetDir);

  console.log(`Successfully installed ${pkgName}!`);
}

const pkgs = process.argv.slice(2);
if (pkgs.length > 0) {
  for (const p of pkgs) {
    const [name, ver] = p.split('@');
    // Handle scoped packages e.g. @microsoft/signalr
    let realName = name;
    let realVer = ver;
    if (p.startsWith('@')) {
      const parts = p.slice(1).split('@');
      realName = `@${parts[0]}`;
      realVer = parts[1] || 'latest';
    }
    await installPackage(realName, realVer || 'latest');
  }
}
