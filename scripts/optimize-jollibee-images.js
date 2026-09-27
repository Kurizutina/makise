const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// Was 'Jollibee' - the actual live catalog (121 products, checked against
// the real ImagePath values in the database) serves from 'Jollibee (MVP)'
// instead. The plain 'Jollibee' folder is a small, already-optimized
// leftover only 3 stale products still reference.
const TARGET_DIR = path.join(__dirname, '..', 'public', 'images', 'Jollibee (MVP)');
const MAX_WIDTH = 800;
const JPEG_QUALITY = 75;

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const fullPath = path.join(dir, entry.name);
  if (entry.isDirectory()) return walk(fullPath);
  return /\.(jpe?g|png)$/i.test(entry.name) ? [fullPath] : [];
});

const optimize = async (file) => {
  const before = fs.statSync(file).size;
  const isPng = /\.png$/i.test(file);
  // Keep the original format - the database's ImagePath still points at
  // this exact filename/extension, and the original version of this
  // script silently wrote JPEG bytes into .png-named files (a real bug:
  // the content and the extension stopped matching).
  const pipeline = sharp(file).resize({ width: MAX_WIDTH, withoutEnlargement: true });
  // Plain re-encoding (compressionLevel alone) can make an already-small
  // PNG *larger* - confirmed live on a sample file (453KB -> 574KB).
  // Palette quantization is what actually shrinks a photographic PNG.
  const buffer = isPng
    ? await pipeline.png({ quality: 80, palette: true }).toBuffer()
    : await pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toBuffer();
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
