<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Service extends Model
{
    protected $table = 'Services';
    protected $primaryKey = 'ServiceID';
    protected $fillable = ['ServiceName', 'ServiceType', 'Description', 'IsActive'];

    public function brands(): HasMany { return $this->hasMany(Brand::class, 'ServiceID'); }
}
