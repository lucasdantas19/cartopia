<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'allow_contact_delivery',
    ];

    public function deliveries()
    {
        return $this->hasMany(Delivery::class);
    }

    public function recipientDeliveries()
    {
        return $this->hasMany(Delivery::class, 'recipient_user_id');
    }

    public function savedLocations()
    {
        return $this->hasMany(SavedLocation::class);
    }

    public function savedRecipients()
    {
        return $this->hasMany(SavedRecipient::class);
    }

    public function trackedDeliveries()
    {
        return $this->hasMany(TrackedDelivery::class);
    }

    public function deliveryPreferences()
    {
        return $this->hasMany(DeliveryPreference::class, 'recipient_user_id');
    }

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
        'api_token_hash',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'allow_contact_delivery' => 'boolean',
        ];
    }
}
