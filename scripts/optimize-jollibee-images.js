const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const TARGET_DIR = path.join(__dirname, '..', 'public', 'images', 'Jollibee');
const MAX_WIDTH = 800;
const JPEG_QUALITY = 75;

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const fullPath = path.join(dir, entry.name);
  if (entry.isDirectory()) return walk(fullPath);
  return /\.(jpe?g|png)$/i.test(entry.name) ? [fullPath] : [];
});

const optimize = async (file) => {
  const before = fs.statSync(file).size;
  const buffer = await sharp(file)
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer();
  const tempFile = `${file}.tmp`;
  fs.writeFileSync(tempFile, buffer);
  fs.renameSync(tempFile, file);
  const after = fs.statSync(file).size;
  console.log(`${path.relative(TARGET_DIR, file)}: ${(before / 1024 / 1024).toFixed(2)}MB -> ${(after / 1024).toFixed(0)}KB`);
};

(async () => {
  const files = walk(TARGET_DIR);
  console.log(`Found ${files.length} images to optimize in ${TARGET_DIR}`);
  for (const file of files) {
    await optimize(file);
  }
  console.log('Done.');
})();
