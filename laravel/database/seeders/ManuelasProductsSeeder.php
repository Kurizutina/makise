<?php

namespace Database\Seeders;

use App\Models\Brand;
use App\Models\Product;
use Illuminate\Database\Seeder;

class ManuelasProductsSeeder extends Seeder
{
    public function run(): void
    {
        $brand = Brand::where('BrandName', "Manuela's")->first();
        $path = database_path('seeders/data/manuelas-products.json');
        if (!$brand || !is_file($path)) return;

        foreach (json_decode((string) file_get_contents($path), true, 512, JSON_THROW_ON_ERROR) as $item) {
            Product::firstOrCreate(
                ['BrandID' => $brand->BrandID, 'ProductName' => $item['name']],
                ['ProductPrice' => $item['price'], 'Description' => $item['category'], 'IsActive' => true]
            );
        }
    }
}
