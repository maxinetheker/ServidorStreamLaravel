<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class StreamKey extends Model
{
    protected $fillable = [
        'user_id',
        'stream_key',
        'is_active'
    ];

    protected $casts = [
        'is_active' => 'boolean'
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public static function generateStreamKey(): string
    {
        do {
            $streamKey = Str::random(32);
        } while (self::where('stream_key', $streamKey)->exists());

        return $streamKey;
    }
}
