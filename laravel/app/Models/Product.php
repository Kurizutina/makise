<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Product extends Model
{
    protected $table = 'Product';
    protected $primaryKey = 'ProductID';
    public $timestamps = false;
    protected $fillable = ['ProductName', 'BrandID', 'ImagePath', 'ProductPrice', 'Description', 'IsActive', 'Embedding'];
    protected $casts = ['Embedding' => 'array'];

    public function brand(): BelongsTo { return $this->belongsTo(Brand::class, 'BrandID'); }
    public function orderItems(): HasMany { return $this->hasMany(OrderItem::class, 'ProductID'); }
}
