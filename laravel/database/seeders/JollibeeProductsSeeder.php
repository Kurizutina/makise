<?php

namespace Database\Seeders;

use App\Models\Brand;
use App\Models\Product;
use App\Models\Service;
use Illuminate\Database\Seeder;

class JollibeeProductsSeeder extends Seeder
{
    public function run(): void
    {
        $service = Service::where('ServiceName', 'Food Delivery')->first();
        $brand = Brand::firstOrCreate(['BrandName' => 'Jollibee'], [
            'ServiceID' => $service?->ServiceID,
            'ImagePath' => '/images/jollibee_logo.jpg',
            'IsActive' => true,
        ]);
        $products = [
            ['Chickenjoy', 'C1 - 1pc Chickenjoy', 99, '/images/Jollibee/ChickenJoy/C1%20-%201p%20Chickenjoy.jpg'],
            ['Chickenjoy', 'C2 - 2pc Chickenjoy w Drink', 215, '/images/Jollibee/ChickenJoy/C2%20-%202pc%20Chickenjoy%20w%20Drink.jpg'],
            ['Chickenjoy', 'C3 - 1pc Chickenjoy w Jolly Spaghetti w Drink', 165, '/images/Jollibee/ChickenJoy/C3%20-%201%20pc%20Chickenjoy%20w%20Jolly%20Spaghetti%20w%20Drink.jpg'],
            ['Chickenjoy', 'C4 - 1pc Chickenjoy w Fries & Drink', 175, '/images/Jollibee/ChickenJoy/C4%20-%201pc.%20Chickenjoy%20w%20Fries%20%26%20Drink.jpg'],
            ['Chickenjoy', 'C8 - 1pc Chickenjoy w Burger Steak & Drink', 195, '/images/Jollibee/ChickenJoy/C8-%201pc%20Chickenjoy%20w%20Burger%20Steak%20%26%20Drink.jpg'],
            ['Chickenjoy', '1pc Chickenjoy w Mashed Potato & Drink', 189, '/images/Jollibee/ChickenJoy/1pc%20Chickenjoy%20w%20Mashed%20Potato%20%26%20Drink.jpg'],
            ['Burgers & Sandwiches', 'Y1 - Yumberger', 60, '/images/Jollibee/Burgers/Y1%20-%20Yumberger.jpg'],
            ['Burgers & Sandwiches', 'Y2 - Original Cheesy Yumburger', 85, '/images/Jollibee/Burgers/Y2%20-%20Original%20Cheesy%20Yumburger.jpg'],
            ['Burgers & Sandwiches', 'Y3 - Bacon Cheesy Yumburger', 110, '/images/Jollibee/Burgers/Y3%20-Bacon%20Cheesy%20Yumburher.jpg'],
            ['Burgers & Sandwiches', 'Y4 - Champ Jr.', 130, '/images/Jollibee/Burgers/Y4%20-%20Champ%20Jr..jpg'],
            ['Burgers & Sandwiches', 'Y5 - Special Cheesy Yumburger', 105, '/images/Jollibee/Burgers/Y5%20-%20Spacial%20Cheesy%20Yumburger.jpg'],
            ['Burgers & Sandwiches', 'Y6 - Aloha Champ Jr.', 150, '/images/Jollibee/Burgers/Y6%20-%20Aloha%20Champ%20Jr..jpg'],
            ['Burgers & Sandwiches', 'Crunchy Chicken Sandwich w Fries & Drink', 185, '/images/Jollibee/Sandwiches%20%26%20Snacks/Crunchy%20Chicken%20Sandwich%20w%20Fries%20%26%20Drink.jpg'],
            ['Burgers & Sandwiches', 'Cheesy Classic Jolly Hotdog w Fries & Drink', 140, '/images/Jollibee/Sandwiches%20%26%20Snacks/Cheesy%20Classic%20Jolly%20Hotdog%20w%20Fries%20%26%20Drink.jpg'],
            ['Jolly Spaghetti & Combos', 'S2 - Jolly Spaghetti w Fries & Drink', 135, '/images/Jollibee/Jolly%20Sphagetti/S2%20-%20Jolly%20Spaghetti%20w%20Fries%20%26%20Drink.jpg'],
            ['Jolly Spaghetti & Combos', 'S3 - Jolly Spaghetti w Yumburger w Drink', 145, '/images/Jollibee/Jolly%20Sphagetti/S3%20-%20Jolly%20Spaghetti%20w%20Yumburger%20w%20Drink.jpg'],
            ['Jolly Spaghetti & Combos', 'S4 - Jolly Spaghetti w Cheesy Yumburger w Drink', 160, '/images/Jollibee/Jolly%20Sphagetti/S4%20-%20Jolly%20Spaghetti%20w%20Cheesy%20Yumburger%20w%20Drink.jpg'],
            ['Jolly Spaghetti & Combos', 'S5 - Jolly Spaghetti w 1pc Burger Steak Solo', 140, '/images/Jollibee/Jolly%20Sphagetti/S5%20-%20Jolly%20Spaghetti%20w%201pc%20Burger%20Steak%20Solo.jpg'],
            ['Burger Steak & Fillets', '1pc Burger Steak w Drink', 95, '/images/Jollibee/Chicken%20Fillet%20%26%20Burger%20Steak/1pc%20Burger%20Steak%20w%20Drink.jpg'],
            ['Burger Steak & Fillets', '1pc Burger Steak w Fries & Drink', 130, '/images/Jollibee/Chicken%20Fillet%20%26%20Burger%20Steak/1pc%20Burger%20Steak%20w%20Fries%20%26%20Drink.jpg'],
            ['Burger Steak & Fillets', '2pc Burger Steak w Drink', 145, '/images/Jollibee/Chicken%20Fillet%20%26%20Burger%20Steak/2pc%20Burger%20Steak%20w%20Drink.jpg'],
            ['Burger Steak & Fillets', 'Pepper Cream Chicken Fillet w Drink', 110, '/images/Jollibee/Chicken%20Fillet%20%26%20Burger%20Steak/Pepper%20Cream%20Chicken%20Fillet%20w%20Drink.jpg'],
            ['Burger Steak & Fillets', 'Pepper Cream Chicken Fillet w Fries & Drink', 150, '/images/Jollibee/Chicken%20Fillet%20%26%20Burger%20Steak/Pepper%20Cream%20Chicken%20Fillet%20w%20Fries%20%26%20Drink.jpg'],
            ['Burger Steak & Fillets', 'Pepper Cream w Jolly Spaghetti & Drink', 165, '/images/Jollibee/Chicken%20Fillet%20%26%20Burger%20Steak/Pepper%20Cream%20w%20Jolly%20Spaghetti%20%26%20Drink.jpg'],
            ['Nuggets', '6pc Chicken Nuggets', 120, '/images/Jollibee/Sandwiches%20%26%20Snacks/6p%20Chicken%20Nuggets.jpg'],
            ['Nuggets', '10pc Chicken Nuggets', 190, '/images/Jollibee/Sandwiches%20%26%20Snacks/10p%20Chicken%20Nuggets.jpg'],
            ['Sides & Desserts', 'Fries', 50, '/images/Jollibee/Sandwiches%20%26%20Snacks/Fries.jpg'],
            ['Sides & Desserts', 'Jolly Crispy Fries Bucket', 175, '/images/Jollibee/Sandwiches%20%26%20Snacks/Jolly%20Crispy%20Fries%20Bucket.jpg'],
            ['Sides & Desserts', 'Peach Mango Pie', 45, '/images/Jollibee/Sandwiches%20%26%20Snacks/Peach%20Mango%20Pie.jpg'],
            ['Sides & Desserts', 'Tuna Pie', 50, '/images/Jollibee/Sandwiches%20%26%20Snacks/Tuna%20Pie.jpg'],
        ];

        foreach ($products as [$category, $name, $price, $image]) {
            Product::firstOrCreate(['BrandID' => $brand->BrandID, 'ProductName' => $name], [
                'ProductPrice' => $price, 'Description' => $category, 'ImagePath' => $image, 'IsActive' => true,
            ]);
        }
    }
}
