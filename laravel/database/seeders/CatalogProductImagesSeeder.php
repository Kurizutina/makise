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
                // An earlier import ran through the wrong character encoding,
                // turning McCafé into McCaf??. Match that damaged value as
                // well as the canonical manifest name, then restore both the
                // display name and its exact image path from the source menu.
                $knownNames = array_unique([
                    $item['name'],
                    // The old database represented é as ?? and an en dash
                    // as ???. Both variants are currently visible in the
                    // McDonald's menu and must resolve to the manifest item.
                    str_replace(['é', '–'], ['??', '???'], $item['name']),
                    // Correct the legacy extra-item spelling while applying
                    // its image from the same manifest.
                    $item['name'] === 'Extra Cheese' ? 'Extra Cheesee' : $item['name'],
                ]);
                Product::where('BrandID', $brand->BrandID)
                    ->whereIn('ProductName', $knownNames)
                    ->update([
                        'ProductName' => $item['name'],
                        'ImagePath' => $item['image'],
                    ]);
            }
        }
    }
}
