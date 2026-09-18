const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../public/images/Hongdae Chicken');
const image = (category, file) => `/images/Hongdae Chicken/${category}/${file}`;
const rows = [
  ['Boneless Chicken', 'Signature Boneless Chicken With Rice Ala Carte (1 Pc With Rice)', 144, image('Boneless Chicken', 'Signature Boneless Chicken With Rice Ala Carte.webp')],
  ['Boneless Chicken', 'Signature Boneless Chicken With Rice Ala Carte (2 Pcs With Rice)', 216, image('Boneless Chicken', 'Signature Boneless Chicken With Rice Ala Carte.webp')],
  ['Boneless Chicken', 'Signature Boneless Chicken With Rice Ala Carte (3 Pcs With Rice)', 287, image('Boneless Chicken', 'Signature Boneless Chicken With Rice Ala Carte.webp')],
  ['Boneless Chicken', 'Premium Boneless Chicken With Rice Ala Carte (1 Pc With Rice)', 151, image('Boneless Chicken', 'Premium Boneless Chicken With Rice Ala Carte.webp')],
  ['Boneless Chicken', 'Premium Boneless Chicken With Rice Ala Carte (2 Pcs With Rice)', 226, image('Boneless Chicken', 'Premium Boneless Chicken With Rice Ala Carte.webp')],
  ['Boneless Chicken', 'Premium Boneless Chicken With Rice Ala Carte (3 Pcs With Rice)', 297, image('Boneless Chicken', 'Premium Boneless Chicken With Rice Ala Carte.webp')],
  ['Boneless Chicken', 'Signature Chicken (Half – 6–7 Pcs)', 476, image('Boneless Chicken', 'Signature Chicken.webp')],
  ['Boneless Chicken', 'Signature Chicken (Whole – 12–14 Pcs)', 898, image('Boneless Chicken', 'Signature Chicken.webp')],
  ['Boneless Chicken', 'Premium Chicken (Half – 6–7 Pcs)', 492, image('Boneless Chicken', 'Premium Chicken.webp')],
  ['Boneless Chicken', 'Premium Chicken (Whole – 12–14 Pcs)', 968, image('Boneless Chicken', 'Premium Chicken.webp')],
  ['Combo Meal', '2 Flavors – 2 Signature (Half – 6–7 Pcs)', 494, image('Combo Meal', '2 Signature.webp')],
  ['Combo Meal', '2 Flavors – 2 Signature (Whole – 12–14 Pcs)', 925, image('Combo Meal', '2 Signature.webp')],
  ['Combo Meal', '2 Flavors – 2 Premium (Half – 6–7 Pcs)', 518, image('Combo Meal', '2 Premium.webp')],
  ['Combo Meal', '2 Flavors – 2 Premium (Whole – 12–14 Pcs)', 958, image('Combo Meal', '2 Premium.webp')],
  ['Combo Meal', '2 Flavors – 1 Signature & 1 Premium (Half – 6–7 Pcs)', 503, image('Combo Meal', '1 Signature & 1 Premium.webp')],
  ['Combo Meal', '2 Flavors – 1 Signature & 1 Premium (Whole – 12–14 Pcs)', 958, image('Combo Meal', '1 Signature & 1 Premium.webp')],
  ['Popcorn Chicken', 'Popcorn Chicken (Half Order – No Rice)', 583, image('Popcorn Chicken', 'Popcorn Chicken.webp')],
  ['Popcorn Chicken', 'Popcorn Chicken (Budget Meal)', 182, image('Popcorn Chicken', 'Popcorn Chicken.webp')],
  ['Popcorn Chicken', 'Popcorn Chicken (Solo Meal)', 258, image('Popcorn Chicken', 'Popcorn Chicken.webp')],
  ['Popcorn Chicken', 'Popcorn Chicken (Full Meal)', 335, image('Popcorn Chicken', 'Popcorn Chicken.webp')],
  ['Extras', 'Extra Rice', 60, image('Extras', 'Extra Rice.webp')],
  ['Extras', 'Flavored Fries', 100, image('Extras', 'Flavored Fries.jpg')],
  ['Extras', 'Kimchi', 50, image('Extras', 'Kimchi.webp')],
  ['Extras', 'Pickled Radish', 50, image('Extras', 'Pickled Radish.webp')],
  ['Extras', 'Pickled Cucumber', 50, image('Extras', 'Pickled Cucumber.webp')],
  ['Extras', 'Kimchi in a Tub (300g)', 190, image('Extras', 'Kimchi in a Tub 300g.webp')],
  ['Extras', 'Extra Sauce', 45, image('Extras', 'Extra Sauce.webp')],
  ['Beverages', 'Raspberry Tea', 60, image('Beverages', 'Raspberry Tea.webp')],
  ['Beverages', 'Iced Tea', 60, image('Beverages', 'Iced Tea.webp')],
  ['Beverages', 'Bottled Water', 45, image('Beverages', 'Bottled Water.webp')],
  ['Beverages', 'Coke (1.5 Liter)', 230, image('Beverages', 'Coke.webp')],
  ['Beverages', 'Soft Beverages in Can', 85, image('Beverages', 'SoftBeverage in Can.webp')],
  ['Beverages', 'Soda Pop', 112, image('Beverages', 'Soda Pop.webp')]
];

const manifest = rows.map(([category, name, price, imagePath]) => ({ category, name, price, image: imagePath }));
fs.writeFileSync(path.join(root, 'menu-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`Generated ${manifest.length} Hongdae Chicken products.`);
