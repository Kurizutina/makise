<?php

namespace App\Http\Controllers;

use App\Models\Brand;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\Service;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class CatalogController extends Controller
{
    public function publicCatalog(): JsonResponse
    {
        $services = Service::query()
            ->where('IsActive', true)
            ->select(['ServiceID', 'ServiceName', 'ServiceType', 'Description'])
            ->with(['brands' => fn ($query) => $query->where('IsActive', true)
                ->whereNotNull('BrandName')->where('BrandName', '<>', '')
                ->select(['BrandID', 'BrandName', 'ServiceID', 'ImagePath'])
                ->withCount(['products' => fn ($products) => $products->where('IsActive', true)])
                ->orderByRaw("CASE WHEN BrandName LIKE 'Others%' THEN 1 ELSE 0 END")
                ->orderBy('BrandName')])
            ->orderBy('ServiceID')->get();
        return response()->json(['services' => $services])
            ->header('Cache-Control', 'no-store');
    }

    // Windowed to the last 30 days, not all-time, so this reflects current
    // demand rather than whatever sold well once months ago. Cancelled
    // orders don't count as real demand for a product. Products whose brand
    // has since been deactivated are filtered out after the aggregation
    // (rather than joined out up front) since that's the rare case, not the
    // common one, and keeping the SUM query itself simple matters more here.
    public function bestSellers(Request $request): JsonResponse
    {
        $limit = min(max((int) $request->query('limit', 8), 1), 20);

        $unitsSoldByProductId = OrderItem::query()
            ->select('OrderItem.ProductID')
            ->selectRaw('SUM(OrderItem.ProductQuantity) as units_sold')
            ->join('Orders', 'Orders.OrderID', '=', 'OrderItem.OrderID')
            ->where('Orders.OrderDate', '>=', now()->subDays(30))
            ->where('Orders.DeliveryStatus', '!=', 'cancelled')
            ->groupBy('OrderItem.ProductID')
            ->orderByDesc('units_sold')
            ->limit($limit)
            ->pluck('units_sold', 'OrderItem.ProductID');

        if ($unitsSoldByProductId->isEmpty()) {
            return response()->json(['products' => []]);
        }

        $products = Product::whereIn('ProductID', $unitsSoldByProductId->keys())
            ->where('IsActive', true)
            ->with(['brand' => fn ($query) => $query->where('IsActive', true)])
            ->get()
            ->filter(fn (Product $product) => $product->brand !== null)
            ->sortByDesc(fn (Product $product) => $unitsSoldByProductId[$product->ProductID])
            ->values()
            ->map(fn (Product $product) => [
                'ProductID' => $product->ProductID,
                'ProductName' => $product->ProductName,
                'ProductPrice' => $product->ProductPrice,
                'ImagePath' => $product->ImagePath,
                'BrandID' => $product->BrandID,
                'BrandName' => $product->brand->BrandName,
                'BrandImagePath' => $product->brand->ImagePath,
                'unitsSold' => $unitsSoldByProductId[$product->ProductID],
            ]);

        return response()->json(['products' => $products]);
    }

    public function publicProducts(Brand $brand): JsonResponse
    {
        if (!$brand->IsActive || !$brand->service?->IsActive) {
            return response()->json(['error' => 'Brand not available'], 404);
        }
        $brand->load('service:ServiceID,ServiceName,ServiceType,IsActive');
        $products = $brand->products()
            ->where('IsActive', true)
            ->select(['ProductID', 'BrandID', 'ProductName', 'ProductPrice', 'ImagePath', 'Description'])
            ->orderBy('ProductName')->get();
        return response()->json(['brand' => $brand, 'products' => $products])
            ->header('Cache-Control', 'no-store');
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
            $data['ImagePath'] = '/uploads/brands/'.$this->storeCompressedImage($r->file('Logo'), public_path('uploads/brands'));
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
            $data['ImagePath'] = '/uploads/products/'.$this->storeCompressedImage($r->file('Image'), public_path('uploads/products'));
        }
        unset($data['Image']);
        return $data;
    }

    // Moves the uploaded file, then downsizes it in place (best-effort - if
    // anything about compression fails, the original upload that's already
    // on disk is left exactly as uploaded rather than blocking the save).
    // Mirrors the client-side compression already applied to bill-payment
    // uploads (PayBillsForm.jsx's compressImage: cap the longest edge at
    // 1280px), but keeps the original format instead of forcing JPEG -
    // brand/product images are frequently PNGs with real transparency
    // (logos), and flattening those to JPEG would bake in a visible
    // background. GIFs are left untouched entirely so an animated logo
    // doesn't get reduced to its first frame.
    private function storeCompressedImage($file, string $directory): string
    {
        if (!is_dir($directory)) mkdir($directory, 0755, true);
        $filename = Str::uuid()->toString().'.'.$file->extension();
        $file->move($directory, $filename);
        $this->compressImageInPlace($directory.DIRECTORY_SEPARATOR.$filename);
        return $filename;
    }

    private function compressImageInPlace(string $path): void
    {
        if (!extension_loaded('gd')) return;
        $maxDimension = 1280;
        try {
            $info = @getimagesize($path);
            if (!$info) return;
            [$width, $height, $type] = $info;
            if (!$width || !$height || max($width, $height) <= $maxDimension) return;
            $scale = $maxDimension / max($width, $height);
            $newWidth = (int) round($width * $scale);
            $newHeight = (int) round($height * $scale);
            $source = match ($type) {
                IMAGETYPE_JPEG => imagecreatefromjpeg($path),
                IMAGETYPE_PNG => imagecreatefrompng($path),
                IMAGETYPE_WEBP => function_exists('imagecreatefromwebp') ? imagecreatefromwebp($path) : null,
                default => null, // GIF (animation) and anything else: leave untouched
            };
            if (!$source) return;
            $resized = imagecreatetruecolor($newWidth, $newHeight);
            if ($type === IMAGETYPE_PNG) {
                imagealphablending($resized, false);
                imagesavealpha($resized, true);
            }
            imagecopyresampled($resized, $source, 0, 0, 0, 0, $newWidth, $newHeight, $width, $height);
            match ($type) {
                IMAGETYPE_JPEG => imagejpeg($resized, $path, 80),
                IMAGETYPE_PNG => imagepng($resized, $path, 6),
                IMAGETYPE_WEBP => function_exists('imagewebp') ? imagewebp($resized, $path, 80) : null,
                default => null,
            };
            imagedestroy($source);
            imagedestroy($resized);
        } catch (\Throwable $error) {
            // Best-effort only - never let a compression failure block an
            // otherwise-successful catalog save.
        }
    }
}
