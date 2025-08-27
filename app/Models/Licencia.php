<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Licencia extends Model
{
    //
    protected $table = "licencias";

    protected $fillable = [
        'user_id',
        'tipo',
        'active',
        'retransmision',
        'controlremoto',
        'videosfallback',
    ];

    protected $casts = [
        'active' => 'boolean',
        'retransmision' => 'boolean',
        'controlremoto' => 'boolean',
        'videosfallback' => 'boolean',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class)->withDefault([
            'active' => false,
            'tipo' => 'free'
        ]);
    }
}
