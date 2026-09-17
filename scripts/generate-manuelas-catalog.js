// Generate the Laravel import snapshot from the customer-facing menu source.
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'src/components/home/ManuelasMenu/manuelasMenuData.js');
const destination = path.join(root, 'laravel/database/seeders/data/manuelas-products.json');

(async () => {
  const code = fs.readFileSync(source, 'utf8');
  const { manuelasMenuData } = await import(`data:text/javascript,${encodeURIComponent(code)}`);
  const products = manuelasMenuData.flatMap((item) => {
    const variants = item.variants?.length ? item.variants : [{ label: null, price: item.price }];
    return variants.map((variant) => ({
      name: variant.label ? `${item.name} (${variant.label})` : item.name,
      category: item.category,
      price: variant.price
    }));
  });
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, `${JSON.stringify(products, null, 2)}\n`);
  console.log(`Generated ${products.length} Manuela's catalog products.`);
})().catch((error) => { console.error(error); process.exitCode = 1; });
