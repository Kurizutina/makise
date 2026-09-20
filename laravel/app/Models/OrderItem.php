<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrderItem extends Model
{
    protected $table = 'OrderItem';
    protected $primaryKey = 'OrderItemID';
    public $timestamps = false;
    protected $fillable = ['ProductID', 'OrderID', 'OrderItemPrice', 'ProductQuantity'];

    public function order(): BelongsTo { return $this->belongsTo(Order::class, 'OrderID'); }
    public function product(): BelongsTo { return $this->belongsTo(Product::class, 'ProductID'); }
}
