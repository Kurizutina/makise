<?php

namespace Database\Seeders;

use App\Models\Brand;
use App\Models\Product;
use Illuminate\Database\Seeder;

class CatalogProductImagesSeeder extends Seeder
{
    public function run(): void
    {
        $manifests = [
            "McDonald's" => base_path('../public/images/Mcdo (Mega Meal)/menu-manifest.json'),
            'Mang Inasal' => base_path('../public/images/Mang Inasal/menu-manifest.json'),
        ];

        foreach ($manifests as $brandName => $path) {
            $brand = Brand::where('BrandName', $brandName)->first();
            if (!$brand || !is_file($path)) continue;

            foreach (json_decode((string) file_get_contents($path), true, 512, JSON_THROW_ON_ERROR) as $item) {
                if (empty($item['name']) || empty($item['image'])) continue;
                Product::where('BrandID', $brand->BrandID)
                    ->where('ProductName', $item['name'])
                    ->whereNull('ImagePath')
                    ->update(['ImagePath' => $item['image']]);
            }
        }
    }
}
