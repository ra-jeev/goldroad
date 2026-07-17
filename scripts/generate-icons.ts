import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import sharp from 'sharp';

const iconMasterPath = 'public/icons/icon-master.svg';
const ogMasterPath = 'public/icons/og-image.svg';

async function renderPng(input: string | Buffer, outputPath: string, width: number, height: number) {
  await mkdir(dirname(outputPath), { recursive: true });
  await sharp(input).resize(width, height).png().toFile(outputPath);
}

function buildMaskableSvg(masterSvg: string) {
  // Full-bleed background + shrink the art group into the maskable safe zone.
  return masterSvg
    .replace(
      '<rect width="512" height="512" rx="112" fill="url(#bgGrad)"/>',
      '<rect width="512" height="512" rx="0" fill="url(#bgGrad)"/>',
    )
    .replace(
      '<g id="icon-art">',
      '<g id="icon-art" transform="translate(256 256) scale(0.78) translate(-256 -256)">',
    );
}

function encodeIco(images: Buffer[]) {
  const headerSize = 6;
  const directorySize = 16 * images.length;
  let offset = headerSize + directorySize;
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  const directory = Buffer.alloc(directorySize);
  images.forEach((image, index) => {
    const entryOffset = index * 16;
    const size = index === 0 ? 16 : 32;
    directory.writeUInt8(size, entryOffset);
    directory.writeUInt8(size, entryOffset + 1);
    directory.writeUInt8(0, entryOffset + 2);
    directory.writeUInt8(0, entryOffset + 3);
    directory.writeUInt16LE(1, entryOffset + 4);
    directory.writeUInt16LE(32, entryOffset + 6);
    directory.writeUInt32LE(image.length, entryOffset + 8);
    directory.writeUInt32LE(offset, entryOffset + 12);
    offset += image.length;
  });

  return Buffer.concat([header, directory, ...images]);
}

async function main() {
  const [iconMaster, ogMaster] = await Promise.all([
    readFile(iconMasterPath, 'utf8'),
    readFile(ogMasterPath, 'utf8'),
  ]);
  const iconMasterBuffer = Buffer.from(iconMaster);
  const maskableSvg = Buffer.from(buildMaskableSvg(iconMaster));

  await Promise.all([
    renderPng(iconMasterBuffer, 'public/icons/icon-192.png', 192, 192),
    renderPng(iconMasterBuffer, 'public/icons/icon-512.png', 512, 512),
    renderPng(maskableSvg, 'public/icons/icon-maskable-512.png', 512, 512),
    renderPng(iconMasterBuffer, 'public/apple-touch-icon.png', 180, 180),
    renderPng(Buffer.from(ogMaster), 'public/icons/og-1200x630.png', 1200, 630),
  ]);

  const favicon16 = await sharp(iconMasterBuffer).resize(16, 16).png().toBuffer();
  const favicon32 = await sharp(iconMasterBuffer).resize(32, 32).png().toBuffer();
  await writeFile('public/favicon.ico', encodeIco([favicon16, favicon32]));
}

await main();
