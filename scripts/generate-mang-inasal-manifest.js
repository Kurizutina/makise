const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../public/images/Mang Inasal');
const pricesRoot = path.join(root, 'Prices');
const outputPath = path.join(root, 'menu-manifest.json');
const imageExtensions = new Set(['.webp', '.jpg', '.jpeg', '.png']);

const normalize = (value) => value
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/&/g, ' and ')
  .replace(/\bpcs?\b/g, 'pc')
  .replace(/\bwith\b/g, 'with')
  .replace(/\bpm1\b/g, '1 rice')
  .replace(/\bpm2\b/g, '1 rice')
  .replace(/[^a-z0-9]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const distance = (left, right) => {
  const row = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const saved = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (left[i - 1] === right[j - 1] ? 0 : 1));
      previous = saved;
    }
  }
  return row[right.length];
};

const similarity = (left, right) => left && right
  ? 1 - distance(left, right) / Math.max(left.length, right.length)
  : 0;

const prices = fs.readdirSync(pricesRoot)
  .filter((file) => file.endsWith('.txt'))
  .flatMap((file) => {
    const lines = fs.readFileSync(path.join(pricesRoot, file), 'utf8')
      .replace(/^\uFEFF/, '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const entries = [];
    lines.forEach((line, index) => {
      const next = lines[index + 1]?.match(/(?:Price:\s*)?₱\s*([\d,.]+)/i);
      if (next && !/^(?:Price:\s*)?₱/i.test(line)) {
        entries.push({ name: line, price: Number(next[1].replace(/,/g, '')), source: file });
      }
    });
    return entries;
  })
  .map((entry) => ({ ...entry, normalized: normalize(entry.name) }));

const preferredPrices = {
  'breakfast chicken inasal regular': 139,
  'breakfast pork bbq': 139,
  'breakfast pork sisig': 139,
  'chicken inasal regular': 99,
  'paa large 1 rice': 139,
  'pecho large 1 rice': 169,
  '1pc pork bbq ala carte': 50,
  'pork bbq ala carte': 50,
  '20pc pork bbq party size': 950,
  '20pc spicy pork bbq party size': 999,
  '4pc spicy pork bbq buddy size': 205,
  'pork bbq buddy size': 193,
  'pork bbq family size': 475,
  'grilled liempo': 135,
  'sizzling liempo': 135,
  'lumpiang togue': 29,
  'palabok': 89,
  'palabok party size': 681,
  'palabok with 1pc pork bbq': 165,
  'bangus sisig': 135,
  'pork sisig': 105
};

const categories = fs.readdirSync(root, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name !== 'Prices')
  .map((entry) => entry.name)
  .sort();
const seenProducts = new Set();
const manifest = [];

categories.forEach((category) => {
  const files = fs.readdirSync(path.join(root, category))
    .filter((file) => imageExtensions.has(path.extname(file).toLowerCase()))
    .sort((left, right) => left.localeCompare(right));

  files.forEach((file) => {
    const name = path.basename(file, path.extname(file)).replace(/\s+/g, ' ').trim();
    const productKey = normalize(name);
    if (seenProducts.has(productKey)) return;
    seenProducts.add(productKey);

    let price = preferredPrices[productKey];
    if (!price) {
      const bestMatch = prices.reduce((best, entry) => {
        const score = similarity(productKey, entry.normalized);
        return score > best.score ? { ...entry, score } : best;
      }, { score: -1 });
      price = bestMatch.price;
    }

    manifest.push({
      category: category === 'Rice Meals (Existing Products)' ? 'Rice Meals' : category,
      name,
      price,
      image: `/images/Mang Inasal/${category}/${file}`
    });
  });
});

fs.writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`Generated ${manifest.length} priced Mang Inasal products.`);
