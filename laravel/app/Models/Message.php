<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Message extends Model
{
    protected $table = 'Message';
    protected $primaryKey = 'MessageID';
    public $timestamps = false;
    protected $fillable = ['OrderID', 'SenderUserID', 'MessageBody', 'MessageSeen', 'MessageDate'];
    protected $casts = ['MessageSeen' => 'boolean'];

    public function order(): BelongsTo { return $this->belongsTo(Order::class, 'OrderID'); }
    public function sender(): BelongsTo { return $this->belongsTo(User::class, 'SenderUserID'); }
}
