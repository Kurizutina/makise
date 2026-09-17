<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Brand;
use App\Models\Product;
use Database\Seeders\ManuelasProductsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

class CatalogApiTest extends TestCase
{
    use RefreshDatabase;

    private function token(string $role): string
    {
        $user = User::create([
            'UserName' => ucfirst($role), 'Email' => $role.'@example.com', 'Role' => $role,
            'Contact' => '09123456789', 'PasswordHash' => Hash::make('secret123'),
        ]);
        return $user->createToken('test')->plainTextToken;
    }

    public function test_admin_can_manage_catalog_and_products_require_a_brand(): void
    {
        $token = $this->token('admin');
        $service = $this->withToken($token)->postJson('/api/admin/catalog/services', [
            'ServiceName' => 'Food Delivery', 'Description' => 'Prepared meals', 'IsActive' => true,
        ])->assertCreated()->json();
        $brand = $this->withToken($token)->postJson('/api/admin/catalog/brands', [
            'BrandName' => 'Otu Kitchen', 'ServiceID' => $service['ServiceID'], 'IsActive' => true,
        ])->assertCreated()->json();
        $upload = $this->withToken($token)->post('/api/admin/catalog/brands/'.$brand['BrandID'], [
            '_method' => 'PUT', 'BrandName' => 'Otu Kitchen', 'ServiceID' => $service['ServiceID'],
            'Logo' => UploadedFile::fake()->createWithContent('otu-kitchen.png', str_pad(
                base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL6NwAAAABJRU5ErkJggg=='),
                3 * 1024 * 1024, "\0"
            )),
        ])->assertOk()->assertJsonPath('ImagePath', fn ($path) => str_starts_with($path, '/uploads/brands/'));
        @unlink(public_path(ltrim($upload->json('ImagePath'), '/')));
        $this->withToken($token)->postJson('/api/admin/catalog/products', [
            'ProductName' => 'Chicken Meal', 'ProductPrice' => 120,
        ])->assertUnprocessable()->assertJsonStructure(['error']);
        $product = $this->withToken($token)->postJson('/api/admin/catalog/products', [
            'ProductName' => 'Chicken Meal', 'BrandID' => $brand['BrandID'], 'ProductPrice' => 120,
        ])->assertCreated()->assertJsonPath('brand.BrandName', 'Otu Kitchen')->json();
        $this->withToken($token)->getJson('/api/admin/catalog/products?brand_id='.$brand['BrandID'])
            ->assertOk()->assertJsonPath('data.0.ProductID', $product['ProductID']);
        $this->withToken($token)->deleteJson('/api/admin/catalog/brands/'.$brand['BrandID'])
            ->assertUnprocessable()->assertJsonPath('error', 'Move or delete this brand’s products before deleting the brand.');
    }

    public function test_non_admin_cannot_access_catalog(): void
    {
        $this->withToken($this->token('customer'))->getJson('/api/admin/catalog/services')->assertForbidden();
    }

    public function test_admin_changes_are_visible_to_customers_and_hidden_items_disappear(): void
    {
        $token = $this->token('admin');
        $service = $this->withToken($token)->postJson('/api/admin/catalog/services', [
            'ServiceName' => 'Food Delivery', 'ServiceType' => 'food', 'IsActive' => true,
        ])->assertCreated()->json();
        $brand = $this->withToken($token)->postJson('/api/admin/catalog/brands', [
            'BrandName' => 'Test Kitchen', 'ServiceID' => $service['ServiceID'], 'IsActive' => true,
        ])->assertCreated()->json();
        $product = $this->withToken($token)->postJson('/api/admin/catalog/products', [
            'ProductName' => 'Rice Bowl', 'BrandID' => $brand['BrandID'], 'ProductPrice' => 100,
            'IsActive' => true,
        ])->assertCreated()->json();

        $this->getJson('/api/catalog')->assertOk()
            ->assertJsonPath('services.0.brands.0.products_count', 1);
        $this->getJson('/api/catalog/brands/'.$brand['BrandID'].'/products')->assertOk()
            ->assertJsonPath('products.0.ProductName', 'Rice Bowl');

        $upload = $this->withToken($token)->post('/api/admin/catalog/products/'.$product['ProductID'], [
            '_method' => 'PUT', 'ProductName' => 'Rice Bowl', 'BrandID' => $brand['BrandID'],
            'ProductPrice' => 100, 'IsActive' => '1',
            'Image' => UploadedFile::fake()->createWithContent('rice.png', str_pad(
                base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL6NwAAAABJRU5ErkJggg=='),
                3 * 1024 * 1024, "\0"
            )),
        ])->assertOk();
        $imagePath = $upload->json('ImagePath');
        $this->assertStringStartsWith('/uploads/products/', $imagePath);
        $this->assertFileExists(public_path(ltrim($imagePath, '/')));
        $this->getJson('/api/catalog/brands/'.$brand['BrandID'].'/products')
            ->assertJsonPath('products.0.ImagePath', $imagePath);
        @unlink(public_path(ltrim($imagePath, '/')));

        $this->withToken($token)->putJson('/api/admin/catalog/products/'.$product['ProductID'], [
            'ProductName' => 'Chicken Rice Bowl', 'BrandID' => $brand['BrandID'],
            'ProductPrice' => 125, 'IsActive' => true,
        ])->assertOk();
        $updated = $this->getJson('/api/catalog/brands/'.$brand['BrandID'].'/products')->assertOk()
            ->assertJsonPath('products.0.ProductName', 'Chicken Rice Bowl');
        $this->assertEquals(125, $updated->json('products.0.ProductPrice'));

        $this->withToken($token)->putJson('/api/admin/catalog/products/'.$product['ProductID'], [
            'ProductName' => 'Chicken Rice Bowl', 'BrandID' => $brand['BrandID'],
            'ProductPrice' => 125, 'IsActive' => false,
        ])->assertOk();
        $this->getJson('/api/catalog/brands/'.$brand['BrandID'].'/products')->assertOk()
            ->assertJsonCount(0, 'products');
        $this->getJson('/api/catalog')->assertJsonPath('services.0.brands.0.products_count', 0);

        $this->withToken($token)->putJson('/api/admin/catalog/brands/'.$brand['BrandID'], [
            'BrandName' => 'New Test Kitchen', 'ServiceID' => $service['ServiceID'], 'IsActive' => true,
        ])->assertOk();
        $this->withToken($token)->putJson('/api/admin/catalog/services/'.$service['ServiceID'], [
            'ServiceName' => 'Meals Delivery', 'ServiceType' => 'food', 'IsActive' => true,
        ])->assertOk();
        $this->getJson('/api/catalog')->assertJsonPath('services.0.ServiceName', 'Meals Delivery')
            ->assertJsonPath('services.0.brands.0.BrandName', 'New Test Kitchen');

        $this->withToken($token)->putJson('/api/admin/catalog/brands/'.$brand['BrandID'], [
            'BrandName' => 'New Test Kitchen', 'ServiceID' => $service['ServiceID'], 'IsActive' => false,
        ])->assertOk();
        $this->getJson('/api/catalog')->assertJsonCount(0, 'services.0.brands');
        $this->withToken($token)->putJson('/api/admin/catalog/brands/'.$brand['BrandID'], [
            'BrandName' => 'New Test Kitchen', 'ServiceID' => $service['ServiceID'], 'IsActive' => true,
        ])->assertOk();
        $this->withToken($token)->putJson('/api/admin/catalog/services/'.$service['ServiceID'], [
            'ServiceName' => 'Meals Delivery', 'ServiceType' => 'food', 'IsActive' => false,
        ])->assertOk();
        $this->getJson('/api/catalog')->assertJsonCount(0, 'services');
        $this->getJson('/api/catalog/brands/'.$brand['BrandID'].'/products')->assertNotFound();
        $this->withToken($token)->putJson('/api/admin/catalog/services/'.$service['ServiceID'], [
            'ServiceName' => 'Meals Delivery', 'ServiceType' => 'food', 'IsActive' => true,
        ])->assertOk();

        $this->withToken($token)->deleteJson('/api/admin/catalog/products/'.$product['ProductID'])->assertOk();
        $this->withToken($token)->deleteJson('/api/admin/catalog/brands/'.$brand['BrandID'])->assertOk();
        $this->getJson('/api/catalog')->assertJsonCount(0, 'services.0.brands');
        $this->withToken($token)->deleteJson('/api/admin/catalog/services/'.$service['ServiceID'])->assertOk();
        $this->getJson('/api/catalog')->assertJsonCount(0, 'services');
    }

    public function test_manuelas_menu_import_is_repeatable_and_preserves_admin_price_edits(): void
    {
        $brand = Brand::create(['BrandName' => "Manuela's", 'IsActive' => true]);
        $this->seed(ManuelasProductsSeeder::class);
        $this->assertSame(185, Product::where('BrandID', $brand->BrandID)->count());

        $item = Product::where('BrandID', $brand->BrandID)->where('ProductName', 'Tapsilog')->firstOrFail();
        $item->update(['ProductPrice' => 125]);
        $this->seed(ManuelasProductsSeeder::class);
        $this->assertSame(185, Product::where('BrandID', $brand->BrandID)->count());
        $this->assertEquals(125, $item->fresh()->ProductPrice);
    }
}
