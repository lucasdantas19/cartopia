<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TrackedDelivery extends Model
{
    protected $fillable = ['delivery_id', 'role', 'access_token_encrypted', 'label'];

    public function delivery()
    {
        return $this->belongsTo(Delivery::class);
    }
}
