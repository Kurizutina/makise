// Transcribed from the two supplied Manuela's printed menus. Prices are in PHP.
const items = [];
const add = (category, name, price, variants) => items.push({
  id: `manuelas-${items.length + 1}`, category, name, price, ...(variants ? { variants } : {})
});
const sizes = (labels, prices) => labels.map((label, index) => ({ label, price: prices[index] }));

[
  ['Tapsilog', 100], ['Tocilog', 100], ['Chicksilog', 90], ['Porksilog', 100],
  ['Corned Beef Silog', 90], ['Longsilog (Sweet)', 100], ['Longsilog (Garlic)', 100],
  ['Lumpiasilog', 90], ['Hotsilog', 80], ['Spamsilog', 90],
  ['Bangsilog (Belly)', 90], ['Bagnetsilog', 100]
].forEach(([name, price]) => add('Silog Tayo!', name, price));

[
  ['Crispy Ulo', 630], ['Crispy Pata', 580], ['Crispy Tenga', 180],
  ['Crispy Kare-kare', 260], ['Lechon Kawali', 180], ['Chicharong Bulaklak', 160],
  ["Tokwa’t Baboy", 120], ['Lumpiang Shanghai (10 pcs)', 150], ['Calamares', 160],
  ['Sweet and Sour Fish Fillet', 170], ['Chopsuey', 170], ['Pigar-pigar', 180],
  ['Papaitang Baka', 150], ['Papaitang Kambing', 160], ['Adobong Kambing', 150],
  ['Bulalo', 260], ['Sinigang na Salmon Belly', 260], ['Sinigang na Pampano', 260],
  ['Sinigang na Salmon Head', 210], ['Sinigang na Lechon Kawali', 260],
  ['Fried Chicken (per piece)', 45], ['M1 (1 pc Fried Chicken w/ Rice)', 65],
  ['M2 (2 pcs Fried Chicken w/ Rice)', 110], ['M3 (1 pc Chicken w/ Spaghetti)', 135]
].forEach(([name, price]) => add('Main Dishes', name, price));
add('Main Dishes', 'Crispy Sisig', 160, sizes(
  ['Regular', 'S bilao (6 pax)', 'M bilao (10 pax)', 'L bilao (15 pax)', 'XL bilao (22 pax)'],
  [160, 510, 810, 1120, 1200]
));

const pancitSizes = ['Single', 'S (4 pax)', 'M (6 pax)', 'L (10 pax)', 'XL (12 pax)', 'J (20 pax)'];
[
  ['Pancit Batil Patung (chopped lechon kawali toppings) w/ Egg Soup', [100, 360, 540, 680, 850, 1280]],
  ["Isabela’s Finest Pancit Cabagan", [80, 300, 450, 560, 700, 1040]],
  ['Creamy Spaghetti', [90, 340, 510, 640, 800, 1200]],
  ['Carbonara', [90, 340, 510, 640, 800, 1200]],
  ['Bihon Guisado', [80, 300, 450, 560, 700, 1040]],
  ['Canton Guisado', [80, 300, 450, 560, 700, 1040]],
  ['Bihon Canton Guisado', [80, 300, 450, 560, 700, 1040]],
  ['Palabok', [80, 300, 450, 560, 700, 1040]],
  ['Malabon', [80, 300, 450, 560, 700, 1040]],
  ['Sotanghon Guisado', [90, 340, 510, 640, 800, 1200]],
  ['Sotanghon Canton Guisado', [90, 340, 510, 640, 800, 1200]]
].forEach(([name, prices]) => add('This Is It, Pancit!', name, prices[0], sizes(pancitSizes, prices)));
add('This Is It, Pancit!', 'Lomi', 90);

[
  ['Sizzling Gising-Gising (Natural)', [160, 800, 1600, 2400]],
  ['Sizzling Gising-Gising (Spicy)', [160, 800, 1600, 2400]],
  ['Sizzling Pusit (Natural)', [160, 800, 1600, 2400]],
  ['Sizzling Pusit (Spicy)', [160, 800, 1600, 2400]],
  ['Sizzling Asadong Dila', [170, 850, 1700, 2550]],
  ['Sizzling Sisig', [170, 850, 1700, 2550]],
  ['Pigar-pigar of Pangasinan', [180, 900, 1800, 2700]]
].forEach(([name, prices]) => add('Sizzlers', name, prices[0], sizes(['2–3 pax', '10 pax', '20 pax', '30 pax'], prices)));

[
  ['Creamy Vegetables w/ Quail Eggs', 1900, 2800],
  ['Chicken Caldereta', 2100, 3100], ['Cheesy Chicken Afritada', 2100, 3100],
  ['Chicken Cordon Bleu', 2300, 3400], ['Honey Garlic Soy Chicken', 2100, 3100],
  ['Pininyahang Manok', 2100, 3100], ['Creamy Mushroom Chicken', 2100, 3100],
  ['Pork Caldereta', 2200, 3200], ['Creamy Lenggua in Mushroom Soup', 2200, 3200],
  ['Sweet and Sour Meatballs', 2200, 3200], ['Menudo', 2200, 3200], ['Igado', 2200, 3200],
  ['Cheesy Pork Afritada', 2200, 3200], ['Pork Garlic Pepper Steak', 2200, 3200],
  ['Braised Pineapple Soy Pork', 2200, 3200], ['Pork Salpicao', 2200, 3200],
  ['Beef Teriyaki', 2400, 3400], ['Beef Salpicao', 2400, 3400],
  ['Tender Beef in Mushroom Sauce', 2400, 3400], ['Beef Stew', 2400, 3400],
  ['Beef with Broccoli', 2400, 3400], ['Chili Garlic Buttered Squid', 2500, 3500],
  ['Cantonese Sweet and Sour Shrimp', 3000, 4200], ['Seafood Boil in Cajun Sauce', 3000, 4200]
].forEach(([name, small, large]) => add('Tray Dishes', name, small, sizes(['20 pax', '30 pax'], [small, large])));
add('Tray Dishes', 'Patatim (per piece, good for 4 pax)', 680);

export const manuelasMenuData = items;
