<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Queue extends Model
{
    protected $table = 'Queue';
    protected $primaryKey = 'QueueID';
    public $timestamps = false;
    protected $fillable = ['OrderID', 'QueuePosition', 'QueueStatus', 'QueueDate'];

    public function order(): BelongsTo { return $this->belongsTo(Order::class, 'OrderID'); }
}
