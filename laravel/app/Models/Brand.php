<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Brand extends Model
{
    protected $table = 'Brands';
    protected $primaryKey = 'BrandID';
    protected $fillable = ['BrandName', 'ServiceID', 'ImagePath', 'Description', 'IsActive'];

    public function service(): BelongsTo { return $this->belongsTo(Service::class, 'ServiceID'); }
    public function products(): HasMany { return $this->hasMany(Product::class, 'BrandID'); }
}
