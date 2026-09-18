<?php

namespace Database\Seeders;

use App\Models\Brand;
use App\Models\Product;
use App\Models\Service;
use Illuminate\Database\Seeder;

class CustomerHomeCatalogSeeder extends Seeder
{
    public function run(): void
    {
        $catalog = [
            'Food Delivery' => [
                ['Hongdae Chicken', '/images/Hongdae Chicken/Boneless Chicken/Signature Chicken.webp'], ['Jollibee', '/images/jollibee_logo.jpg'], ["McDonald's", "/images/mcdonald's_logo.png"],
                ['Mang Inasal', '/images/mang_inasal_logo.png'], ["Manuela's", '/images/maluelas_logo.jpg'],
                ["Elena's", "/images/elenas's_logo.jpg"], ['Kuya Dos', '/images/kuya_dos_logo.jpg'],
                ['ButterLand', '/images/butterland_logo.jpg'], ['Others', null],
            ],
            'Item Delivery' => [
                ['Pandayan', '/images/pandayan_logo.jpg'], ['Watsons', '/images/wantons_logo.jpg'],
                ['Mr. DIY', '/images/MR_DIY_logo.jpg'], ['Friendship', '/images/friendship_logo.jpg'],
                ['Public Market', '/images/public_market_logo.jpg'], ['Others', null],
            ],
            'Pay Bills' => [
                ['NEECO 1', '/images/necco1_logo.jpg'], ['PrimeWater Muñoz', '/images/prime_water_logo.jpg'], ['Others', null],
            ],
        ];

        $brands = [];
        foreach ($catalog as $serviceName => $entries) {
            $type = ['Food Delivery' => 'food', 'Item Delivery' => 'item', 'Pay Bills' => 'bills'][$serviceName];
            $service = Service::firstOrCreate(['ServiceName' => $serviceName], ['ServiceType' => $type, 'IsActive' => true]);
            foreach ($entries as [$name, $image]) {
                // "Others" exists once per customer service, so keep names unique in the database.
                $databaseName = $name === 'Others' ? "Others ({$serviceName})" : $name;
                $brands[$name] = $brands[$name] ?? null;
                $brand = Brand::firstOrCreate(['BrandName' => $databaseName], [
                    'ServiceID' => $service->ServiceID, 'ImagePath' => $image, 'IsActive' => true,
                ]);
                if ($name !== 'Others') $brands[$name] = $brand;
            }
        }

        $this->importManifest($brands["McDonald's"], base_path('../public/images/Mcdo (Mega Meal)/menu-manifest.json'));
        $this->importManifest($brands['Mang Inasal'], base_path('../public/images/Mang Inasal/menu-manifest.json'));
        $this->importManifest($brands['Hongdae Chicken'], base_path('../public/images/Hongdae Chicken/menu-manifest.json'));
    }

    private function importManifest(?Brand $brand, string $path): void
    {
        if (!$brand || !is_file($path)) return;
        foreach (json_decode((string) file_get_contents($path), true) ?: [] as $item) {
            if (empty($item['name']) || !isset($item['price'])) continue;
            $product = Product::firstOrCreate(['BrandID' => $brand->BrandID, 'ProductName' => $item['name']], [
                'ProductPrice' => $item['price'],
                'Description' => $item['category'] ?? null, 'ImagePath' => $item['image'] ?? null, 'IsActive' => true,
            ]);
            if (!$product->ImagePath && !empty($item['image'])) $product->update(['ImagePath' => $item['image']]);
        }
    }
}
