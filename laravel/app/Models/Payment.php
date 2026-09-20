<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Payment extends Model
{
    protected $table = 'Payment';
    protected $primaryKey = 'PaymentID';
    public $timestamps = false;
    protected $fillable = ['OrderID', 'PaymentName', 'PaymentMethod', 'PaymentAmount', 'PaymentStatus', 'PaymentNote'];

    public function order(): BelongsTo { return $this->belongsTo(Order::class, 'OrderID'); }
}
