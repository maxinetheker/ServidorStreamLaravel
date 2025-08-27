<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Video extends Model
{
    protected $fillable = [
        'id_usuario',
        'ruta',
        'nombre_original',
        'mime_type',
        'tamaño'
    ];

    protected $casts = [
        'tamaño' => 'integer',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'id_usuario');
    }

    public function getUrlAttribute(): string
    {
        return asset($this->ruta);
    }
}
