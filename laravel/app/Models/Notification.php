<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Notification extends Model
{
    protected $table = 'Notification';
    protected $primaryKey = 'NotificationID';
    public $timestamps = false;
    protected $fillable = ['UserID', 'NotificationMessage', 'NotificationSeen', 'NotificationDate'];
    protected $casts = ['NotificationSeen' => 'boolean'];

    public function user(): BelongsTo { return $this->belongsTo(User::class, 'UserID'); }
}
