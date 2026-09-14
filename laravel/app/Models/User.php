<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory;

    protected $table = 'Users';
    protected $primaryKey = 'UserID';
    public $timestamps = false;
    protected $fillable = ['UserName', 'Contact', 'Role', 'Email', 'PasswordHash', 'Address'];
    protected $hidden = ['PasswordHash'];
    protected $authPasswordName = 'PasswordHash';

    public function profile(): array
    {
        return [
            'id' => $this->UserID, 'username' => $this->UserName, 'contact' => $this->Contact,
            'role' => $this->Role, 'email' => $this->Email, 'address' => $this->Address ?? '',
        ];
    }
}
