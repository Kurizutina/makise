<?php

namespace App\Http\Controllers;

use App\Models\Brand;
use App\Models\Product;
use App\Models\Service;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class CatalogController extends Controller
{
    public function publicCatalog(): JsonResponse
    {
        return response()->json(['services' => Service::query()
            ->where('IsActive', true)
            ->with(['brands' => fn ($query) => $query->where('IsActive', true)
                ->whereNotNull('BrandName')->where('BrandName', '<>', '')
                ->withCount(['products' => fn ($products) => $products->where('IsActive', true)])
                ->orderByRaw("CASE WHEN BrandName LIKE 'Others%' THEN 1 ELSE 0 END")
                ->orderBy('BrandName')])
            ->orderBy('ServiceID')->get()]);
    }

    public function publicProducts(Brand $brand): JsonResponse
    {
        if (!$brand->IsActive || !$brand->service?->IsActive) {
            return response()->json(['error' => 'Brand not available'], 404);
        }
        return response()->json(['brand' => $brand->load('service'), 'products' => $brand->products()
            ->where('IsActive', true)->orderBy('ProductName')->get()]);
    }

    public function options(): JsonResponse
    {
        return response()->json([
            'services' => Service::orderBy('ServiceName')->get(['ServiceID', 'ServiceName']),
            'brands' => Brand::orderByRaw("CASE WHEN BrandName LIKE 'Others%' THEN 1 ELSE 0 END")
                ->orderBy('BrandName')->get(['BrandID', 'BrandName', 'ServiceID']),
        ]);
    }

    private function page(Request $request, $query, array $fields): JsonResponse
    {
        $search = trim((string) $request->query('search'));
        if ($search !== '') $query->where(function ($q) use ($search, $fields) {
            foreach ($fields as $field) $q->orWhere($field, 'like', "%{$search}%");
        });
        $perPage = min(max((int) $request->query('per_page', 10), 1), 50);
        return response()->json($query->paginate($perPage));
    }

    public function services(Request $request): JsonResponse { return $this->page($request, Service::query()->orderBy('ServiceName'), ['ServiceName', 'Description']); }
    public function brands(Request $request): JsonResponse
    {
        $query = Brand::with('service:ServiceID,ServiceName')->withCount('products')
            ->whereNotNull('BrandName')->where('BrandName', '<>', '')
            ->orderByRaw("CASE WHEN BrandName LIKE 'Others%' THEN 1 ELSE 0 END")
            ->orderBy('BrandName');
        if ($request->filled('service_id')) $query->where('ServiceID', $request->integer('service_id'));
        return $this->page($request, $query, ['BrandName', 'Description']);
    }
    public function products(Request $request): JsonResponse
    {
        $query = Product::with('brand:BrandID,BrandName,ServiceID')->orderBy('ProductName');
        if ($request->filled('brand_id')) $query->where('BrandID', $request->integer('brand_id'));
        return $this->page($request, $query, ['ProductName', 'Description']);
    }

    public function categories(Request $request): JsonResponse
    {
        $request->validate(['brand_id' => ['required', 'integer', 'exists:Brands,BrandID']]);
        $categories = Product::query()->where('BrandID', $request->integer('brand_id'))
            ->whereNotNull('Description')->where('Description', '<>', '')
            ->distinct()->orderBy('Description')->pluck('Description')->values();
        return response()->json(['categories' => $categories]);
    }

    public function storeService(Request $request): JsonResponse { $item = Service::create($this->serviceData($request)); return response()->json($item, 201); }
    public function updateService(Request $request, Service $service): JsonResponse { $service->update($this->serviceData($request, true)); return response()->json($service); }
    public function destroyService(Service $service): JsonResponse
    {
        if ($service->brands()->exists()) return response()->json(['error' => 'Move or delete this service’s brands before deleting the service.'], 422);
        $service->delete(); return response()->json(['status' => 'deleted']);
    }
    public function storeBrand(Request $request): JsonResponse { $item = Brand::create($this->brandData($request)); return response()->json($item->load('service'), 201); }
    public function updateBrand(Request $request, Brand $brand): JsonResponse { $brand->update($this->brandData($request, true)); return response()->json($brand->fresh()->load('service')); }
    public function destroyBrand(Brand $brand): JsonResponse
    {
        if ($brand->products()->exists()) return response()->json(['error' => 'Move or delete this brand’s products before deleting the brand.'], 422);
        $brand->delete(); return response()->json(['status' => 'deleted']);
    }
    public function storeProduct(Request $request): JsonResponse { $item = Product::create($this->productData($request)); return response()->json($item->load('brand'), 201); }
    public function updateProduct(Request $request, Product $product): JsonResponse { $product->update($this->productData($request, true)); return response()->json($product->fresh()->load('brand')); }
    public function destroyProduct(Product $product): JsonResponse
    {
        if (\Illuminate\Support\Facades\DB::table('OrderItem')->where('ProductID', $product->ProductID)->exists()) {
            return response()->json(['error' => 'This product is used in an order. Hide it instead of deleting it.'], 422);
        }
        $product->delete(); return response()->json(['status' => 'deleted']);
    }

    private function serviceData(Request $r, bool $partial = false): array { return $r->validate(['ServiceName' => [$partial ? 'sometimes' : 'required', 'string', 'max:100', 'unique:Services,ServiceName'.($partial ? ','.$r->route('service')->ServiceID.',ServiceID' : '')], 'ServiceType' => ['sometimes', 'in:food,item,bills'], 'Description' => ['nullable', 'string', 'max:500'], 'IsActive' => ['boolean']]); }
    private function brandData(Request $r, bool $partial = false): array
    {
        $data = $r->validate([
            'BrandName' => [$partial ? 'sometimes' : 'required', 'string', 'max:150', 'unique:Brands,BrandName'.($partial ? ','.$r->route('brand')->BrandID.',BrandID' : '')],
            'ServiceID' => ['required', 'integer', 'exists:Services,ServiceID'],
            'Description' => ['nullable', 'string', 'max:500'], 'IsActive' => ['boolean'],
            'Logo' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp,gif', 'max:20480'],
        ], ['Logo.max' => 'The brand logo must be 20 MB or smaller.']);
        if ($r->hasFile('Logo')) {
            $file = $r->file('Logo');
            $directory = public_path('uploads/brands');
            if (!is_dir($directory)) mkdir($directory, 0755, true);
            $filename = Str::uuid()->toString().'.'.$file->extension();
            $file->move($directory, $filename);
            $data['ImagePath'] = '/uploads/brands/'.$filename;
        }
        unset($data['Logo']);
        return $data;
    }
    private function productData(Request $r, bool $partial = false): array
    {
        $data = $r->validate([
            'ProductName' => [$partial ? 'sometimes' : 'required', 'string', 'max:150'],
            'BrandID' => [$partial ? 'sometimes' : 'required', 'integer', 'exists:Brands,BrandID'],
            'ProductPrice' => [$partial ? 'sometimes' : 'required', 'numeric', 'min:0', 'max:99999999.99'],
            'Description' => ['nullable', 'string', 'max:500'],
            'IsActive' => ['boolean'], 'Image' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp,gif', 'max:20480'],
        ], ['Image.max' => 'The product image must be 20 MB or smaller.']);
        if ($r->hasFile('Image')) {
            $file = $r->file('Image');
            $directory = public_path('uploads/products');
            if (!is_dir($directory)) mkdir($directory, 0755, true);
            $filename = Str::uuid()->toString().'.'.$file->extension();
            $file->move($directory, $filename);
            $data['ImagePath'] = '/uploads/products/'.$filename;
        }
        unset($data['Image']);
        return $data;
    }
}
