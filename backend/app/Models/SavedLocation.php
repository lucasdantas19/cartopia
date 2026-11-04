<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SavedLocation extends Model
{
    protected $fillable = ['name', 'label', 'latitude', 'longitude', 'is_default'];

    protected function casts(): array
    {
        return ['latitude' => 'float', 'longitude' => 'float', 'is_default' => 'boolean'];
    }
}
