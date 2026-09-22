<?php

namespace Database\Seeders;

use App\Models\Brand;
use App\Models\Product;
use App\Models\Service;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use RuntimeException;

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

        $catalogRoot = base_path('../public/images/Jollibee (MVP)');
        $products = $this->productsForCatalog($catalogRoot, $this->pricesForCatalog($catalogRoot));

        DB::transaction(function () use ($brand, $products): void {
            $referencedProductIds = DB::table('OrderItem')
                ->join('Product', 'OrderItem.ProductID', '=', 'Product.ProductID')
                ->where('Product.BrandID', $brand->BrandID)
                ->pluck('Product.ProductID');

            // Preserve historical order items without offering their retired products for sale.
            Product::where('BrandID', $brand->BrandID)
                ->whereIn('ProductID', $referencedProductIds)
                ->update(['IsActive' => false]);

            Product::where('BrandID', $brand->BrandID)
                ->whereNotIn('ProductID', $referencedProductIds)
                ->delete();

            foreach ($products as $product) {
                Product::updateOrCreate(
                    ['BrandID' => $brand->BrandID, 'ProductName' => $product['name']],
                    [
                        'ProductPrice' => $product['price'],
                        'Description' => $product['category'],
                        'ImagePath' => $product['image'],
                        'IsActive' => true,
                    ],
                );
            }
        });
    }

    private function pricesForCatalog(string $catalogRoot): array
    {
        $prices = [];

        foreach (glob($catalogRoot.'/*/*price list.txt') as $priceList) {
            $lines = preg_split('/\R/', file_get_contents($priceList));
            $lastName = null;

            foreach ($lines as $line) {
                $line = trim($line);
                if ($line === '' || str_contains(strtolower($line), 'price list')) continue;

                if (preg_match('/([0-9][0-9,]*)\.([0-9]{2})/', $line, $match)) {
                    if ($lastName !== null) {
                        $prices[$this->key($lastName)] = (float) str_replace(',', '', $match[1].'.'.$match[2]);
                    }
                    $lastName = null;
                    continue;
                }

                $lastName = $line;
            }
        }

        return $prices;
    }

    private function productsForCatalog(string $catalogRoot, array $prices): array
    {
        $products = [];
        $seen = [];

        foreach (glob($catalogRoot.'/*/*.avif') as $imagePath) {
            $name = pathinfo($imagePath, PATHINFO_FILENAME);
            $key = $this->key($name);

            if (isset($seen[$key])) continue;
            if (!isset($prices[$key])) {
                throw new RuntimeException("No price list entry found for Jollibee product: {$name}");
            }

            $seen[$key] = true;
            $category = basename(dirname($imagePath));
            $publicImagePath = '/images/Jollibee (MVP)/'.rawurlencode($category).'/'.rawurlencode(basename($imagePath));

            $products[] = [
                'name' => $name,
                'category' => $category,
                'price' => $prices[$key],
                'image' => $publicImagePath,
            ];
        }

        return $products;
    }

    private function key(string $value): string
    {
        $value = str_replace(['â€“', '–', '—'], '-', $value);
        $value = str_ireplace(['w/', 'with'], 'with', $value);
        return preg_replace('/[^a-z0-9]+/', '', strtolower($value));
    }
}
