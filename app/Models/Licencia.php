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
        'vencimiento', 
    ];

    protected $casts = [
        'active' => 'boolean',
        'retransmision' => 'boolean',
        'controlremoto' => 'boolean',
        'videosfallback' => 'boolean',
        'vencimiento' => 'date',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class)->withDefault([
            'active' => false,
            'tipo' => 'free',
            'retransmision' => false,
            'controlremoto' => false,
            'videosfallback' => false,
            'vencimiento' => null,
        ]);
    }
}
