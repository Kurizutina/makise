const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../public/images/Kuya Dos');
const image = (category, file) => `/images/Kuya Dos/${category}/${file}`;
const rows = [
  ['Lauriat Meal', 'Pork Lauriat', 230, image('Lauriat Meal', 'Pork Lauriat.webp')],
  ['Lauriat Meal', 'Chicken Lauriat', 230, image('Lauriat Meal', 'Chicken Lauriat.webp')],
  ['Master Wok', 'Pork Chow Fan', 115, image('Master Wok (Chinese Style Fried Rice)', 'Pork Chow Fan.webp')],
  ['Master Wok', 'Kimchi Fried Rice', 128, image('Master Wok (Chinese Style Fried Rice)', 'Kimchi Fried Rice.webp')],
  ['Master Wok', 'Beef Chow Fan', 128, image('Master Wok (Chinese Style Fried Rice)', 'Beef Chow Fan.webp')],
  ['Master Wok', 'Spam Chow Rice', 115, image('Master Wok (Chinese Style Fried Rice)', 'Spam Chow Rice.webp')],
  ['Master Wok', 'Yang Chow Fried Rice', 135, image('Master Wok (Chinese Style Fried Rice)', 'Yang Chow Fried Rice.webp')],
  ['Master Wok', 'Sisig Chowrice', 125, image('Master Wok (Chinese Style Fried Rice)', 'Sisig Chowrice.webp')],
  ['Pansiteria', 'Pansit Canton Guisado', 125, image('Pansiteria', 'Pansit CANTON Guisado.webp')],
  ['Pansiteria', 'Pansit Bihon Guisado', 125, image('Pansiteria', 'Pansit BIHON Guisado.webp')],
  ['Pansiteria', 'Batangas Lomi', 112, image('Pansiteria', 'Batangas Lomi.webp')],
  ['Pares and Wonton Mami', 'Wonton Mami', 125, image('Pares and Wonton Mami', 'Wonton Mami.webp')],
  ['Pares and Wonton Mami', 'Dos Pares Overload', 195, image('Pares and Wonton Mami', 'Dos Pares Overload.webp')],
  ['Pares and Wonton Mami', 'TaPares (Beef Pares)', 125, image('Pares and Wonton Mami', 'TaPares (Beef Pares).webp')],
  ['Silog', 'SisigSilog', 134, image('Silog', 'SisigSilog.webp')],
  ['Silog', 'Dos Tapa', 149, image('Silog', 'Dos Tapa.webp')],
  ['Silog', 'ChickSilog', 136, image('Silog', 'ChickSilog.webp')],
  ['Silog', 'LongSilog', 125, image('Silog', 'LongSilog.webp')],
  ['Silog', 'LiempoSilog', 135, image('Silog', 'Garlic Pepper Beef.webp')],
  ['Silog', 'BacSilog', 125, image('Silog', 'BacSilog.webp')],
  ['Silog', 'HotSilog', 95, image('Silog', 'HotSilog.webp')],
  ['Silog', 'TapaWarma', 145, image('Silog', 'TapaWarma.webp')],
  ['Sizzlers', 'Sizzling Dos Sisig', 148, image('Sizzlers', 'Sizzling Dos Sisig.webp')],
  ['Sizzlers', 'Sizzling Garlic Pepper Beef', 159, image('Sizzlers', 'Sizzling Garlic Pepper Beef.webp')],
  ['Sizzlers', 'Sizzling Tapawarma', 159, image('Sizzlers', 'Sizzling Tapawarma.webp')],
  ['Sizzlers', 'Sizzling Dos Tapa', 159, image('Sizzlers', 'Sizzling Dos Tapa.webp')],
  ['Sizzlers', 'Sizzling Pork Chop', 164, image('Sizzlers', 'Sizzling Pork Chop.webp')],
  ['Sizzlers', 'Sizzling Dos Pares', 182, image('Sizzlers', 'Sizzling Dos Pares.webp')],
  ['Sizzlers', 'Sizzling Hungarian', 155, image('Sizzlers', 'Sizzling Hungarian.webp')],
  ['Sizzlers', 'Sizzling Liempo', 185, image('Sizzlers', 'Sizzling Liempo.webp')],
  ['Sizzling Overload', 'Sizzling Overload (2 Ulam, 2 Rice)', 215, image('Sizzling Overload', 'Sizzling Overload (2 Ulam, 2 Rice and 1 egg).webp')],
  ['Student Avenue', 'Fried Chicken ala Carte', 66, image('Student Avenue', 'Fried Chicken ala Carte.webp')],
  ['Student Avenue', 'Fried Chicken with Rice', 87, image('Student Avenue', 'Fried Chicken ala Carte.webp')]
];

fs.writeFileSync(path.join(root, 'menu-manifest.json'), `${JSON.stringify(rows.map(([category, name, price, imagePath]) => ({ category, name, price, image: imagePath })), null, 2)}\n`, 'utf8');
console.log(`Generated ${rows.length} Kuya Dos products.`);
