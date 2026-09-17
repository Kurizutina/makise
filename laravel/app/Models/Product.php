<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Product extends Model
{
    protected $table = 'Product';
    protected $primaryKey = 'ProductID';
    public $timestamps = false;
    protected $fillable = ['ProductName', 'BrandID', 'ImagePath', 'ProductPrice', 'Description', 'IsActive'];

    public function brand(): BelongsTo { return $this->belongsTo(Brand::class, 'BrandID'); }
}
