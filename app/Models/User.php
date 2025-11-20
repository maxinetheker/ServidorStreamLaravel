<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasFactory, Notifiable;

    /**
     * The relationships that should always be loaded.
     *
     * @var array
     */
    protected $with = ['licencia'];

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'isadmin',
        'active',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
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
            'isadmin' => 'boolean',
            'active' => 'boolean',
            'licencia' => 'array',
        ];
    }

    public function streamKey(): HasOne
    {
        return $this->hasOne(StreamKey::class);
    }

    public function videos(): HasMany
    {
        return $this->hasMany(Video::class, 'id_usuario');
    }

    public function obsConfiguration(): HasOne
    {
        return $this->hasOne(ObsConfiguration::class);
    }

    public function licencia(): HasOne
    {
        return $this->hasOne(Licencia::class)->withDefault([
            'active' => false,
            'tipo' => 'free',
            'retransmision' => false,
            'controlremoto' => false,
            'videosfallback' => false,
            'vencimiento' => null,
        ]);
    }

    /**
     * Check if the user is an admin.
     *
     * @return bool
     */
    public function isAdmin(): bool
    {
        return $this->isadmin ?? false;
    }

    public function isActive(): bool
    {
        return $this->active ?? false;
    }
}
