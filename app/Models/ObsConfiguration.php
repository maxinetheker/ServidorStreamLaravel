<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ObsConfiguration extends Model
{
    protected $fillable = [
        'user_id',
        'host',
        'port',
        'password',
        'is_active'
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'port' => 'integer'
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
