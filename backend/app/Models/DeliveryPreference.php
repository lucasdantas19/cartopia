<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DeliveryPreference extends Model
{
    protected $fillable = ['recipient_user_id', 'sender_user_id', 'saved_location_id'];

    public function recipientUser()
    {
        return $this->belongsTo(User::class, 'recipient_user_id');
    }

    public function senderUser()
    {
        return $this->belongsTo(User::class, 'sender_user_id');
    }

    public function savedLocation()
    {
        return $this->belongsTo(SavedLocation::class);
    }
}
