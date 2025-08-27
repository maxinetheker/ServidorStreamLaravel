<?php

namespace App\Http\Controllers;

use App\Models\StreamKey;
use App\Http\Controllers\StreamController;
use Illuminate\Http\Request;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;

class StreamKeyController extends Controller
{
    public function generate(Request $request): RedirectResponse
    {
        $user = $request->user();
        
        // Detener stream activo antes de cambiar la clave
        StreamController::stopStreamSilently($user);
        
        // Si ya tiene un stream key, lo eliminamos
        $user->streamKey()?->delete();
        
        // Crear nuevo stream key
        $streamKey = StreamKey::create([
            'user_id' => $user->id,
            'stream_key' => StreamKey::generateStreamKey(),
            'is_active' => true
        ]);
        
        return redirect()->route('configuracion')->with([
            'success' => 'Stream key generado exitosamente',
            'streamKeyData' => [
                'stream_key' => $streamKey->stream_key,
                'is_active' => $streamKey->is_active
            ]
        ]);
    }
    
    public function show(Request $request)
    {
        $user = $request->user();
        $streamKey = $user->streamKey;
        
        return response()->json([
            'stream_key' => $streamKey?->stream_key,
            'is_active' => $streamKey?->is_active ?? false
        ]);
    }
    
    public function regenerate(Request $request): RedirectResponse
    {
        $user = $request->user();
        $streamKey = $user->streamKey;
        
        // Detener stream activo antes de cambiar la clave
        StreamController::stopStreamSilently($user);
        
        if ($streamKey) {
            $streamKey->update([
                'stream_key' => StreamKey::generateStreamKey()
            ]);
        } else {
            $streamKey = StreamKey::create([
                'user_id' => $user->id,
                'stream_key' => StreamKey::generateStreamKey(),
                'is_active' => true
            ]);
        }
        
        return redirect()->route('configuracion')->with([
            'success' => 'Stream key regenerado exitosamente',
            'streamKeyData' => [
                'stream_key' => $streamKey->stream_key,
                'is_active' => $streamKey->is_active
            ]
        ]);
    }
}
