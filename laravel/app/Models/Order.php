<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Order extends Model
{
    protected $table = 'Orders';
    protected $primaryKey = 'OrderID';
    public $timestamps = false;
    protected $fillable = ['UserID', 'TotalPrice', 'OrderDate', 'DeliveryAddress', 'DeliveryStatus'];

    public function user(): BelongsTo { return $this->belongsTo(User::class, 'UserID'); }
    public function items(): HasMany { return $this->hasMany(OrderItem::class, 'OrderID'); }
    public function payments(): HasMany { return $this->hasMany(Payment::class, 'OrderID'); }
    public function queueEntries(): HasMany { return $this->hasMany(Queue::class, 'OrderID'); }
}
