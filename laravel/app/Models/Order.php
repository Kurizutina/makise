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
    protected $fillable = ['UserID', 'AssignedRiderID', 'TotalPrice', 'ServiceFee', 'OrderDate', 'DeliveryAddress', 'OrderSnapshot', 'DeliveryStatus'];

    protected function casts(): array
    {
        return ['OrderSnapshot' => 'array'];
    }

    public function user(): BelongsTo { return $this->belongsTo(User::class, 'UserID'); }
    public function rider(): BelongsTo { return $this->belongsTo(User::class, 'AssignedRiderID'); }
    public function items(): HasMany { return $this->hasMany(OrderItem::class, 'OrderID'); }
    public function payments(): HasMany { return $this->hasMany(Payment::class, 'OrderID'); }
    public function queueEntries(): HasMany { return $this->hasMany(Queue::class, 'OrderID'); }

    // Every order (catalog-backed or a Pay Bills request) gets a real Queue
    // row the moment it exists, regardless of which controller created it -
    // a model event instead of duplicating this in OrderController::store
    // and PaymentController::store keeps it from silently missing a future
    // third order-creation path.
    protected static function booted(): void
    {
        static::created(function (Order $order) {
            $order->queueEntries()->create(['QueueStatus' => 'waiting', 'QueueDate' => now()]);
        });
    }
}
