<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Inertia\Inertia;
use App\Models\ObsConfiguration;
use App\Models\Video;

class StreamingToolController extends Controller
{
    /**
     * Display the streaming tool page
     */
    public function index(Request $request) 
    {
        $user = Auth::user();
        $streamKey = $user->streamKey;
        $obsConfig = $user->obsConfiguration;

        // Obtener datos de OBS si está disponible
        $obsStatusData = ['clients' => [], 'message' => 'No data available'];
        
        if ($streamKey && $obsConfig && $obsConfig->is_active) {
            try {
                $response = Http::withOptions([
                    'verify' => false,
                    'timeout' => 10
                ])->post(env('STREAMING_API_URL') . '/api/obs/status', [
                    'streamKey' => $streamKey->stream_key,
                    'action' => 'get_status'
                ]);

                $data = $response->json();
                $obsStatusData = [
                    'clients' => $data['clients'] ?? [],
                    'message' => $data['message'] ?? 'Status retrieved'
                ];
            } catch (\Exception $e) {
                // Si falla, mantener datos vacíos
                $obsStatusData = ['clients' => [], 'message' => 'Error getting status'];
            }
        }

        return Inertia::render('streamingtool', [
            'hasStreamKey' => !empty($streamKey?->stream_key),
            'streamKey' => $streamKey?->stream_key,
            'hasObsConfig' => !empty($obsConfig),
            'obsConfig' => $obsConfig ? [
                'host' => $obsConfig->host,
                'port' => $obsConfig->port,
                'is_active' => $obsConfig->is_active
            ] : null,
            'obsStatusData' => $obsStatusData
        ]);
    }

    /**
     * Get OBS clients status for API calls
     */
    public function getObsStatusApi()
    {
        $user = Auth::user();
        $streamKey = $user->streamKey;

        if (!$streamKey) {
            return response()->json(['error' => 'No se encontró stream key'], 404);
        }

        try {
            $response = Http::withOptions([
                'verify' => false,
                'timeout' => 30
            ])->post(env('STREAMING_API_URL') . '/api/obs/status', [
                'streamKey' => $streamKey->stream_key,
                'action' => 'get_status'
            ]);

            $data = $response->json();

            return response()->json([
                'clients' => $data['clients'] ?? [],
                'message' => $data['message'] ?? 'Status retrieved'
            ]);

        } catch (\Exception $e) {
            Log::error('OBS status check failed', [
                'error' => $e->getMessage(),
                'user_id' => $user->id
            ]);

            return response()->json(['error' => 'Error al obtener estado de OBS'], 500);
        }
    }

    /**
     * Get OBS clients status
     */
    public function getObsStatus()
    {
        $user = Auth::user();
        $streamKey = $user->streamKey;

        if (!$streamKey) {
            return back()->withErrors(['error' => 'No se encontró stream key']);
        }

        try {
            $response = Http::withOptions([
                'verify' => false,
                'timeout' => 30
            ])->post(env('STREAMING_API_URL') . '/api/obs/status', [
                'streamKey' => $streamKey->stream_key,
                'action' => 'get_status'
            ]);

            $data = $response->json();

            return back()->with([
                'success' => 'Estado actualizado correctamente',
                'obsStatusData' => [
                    'clients' => $data['clients'] ?? [],
                    'message' => $data['message'] ?? 'Status retrieved'
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('OBS status check failed', [
                'error' => $e->getMessage(),
                'user_id' => $user->id
            ]);

            return back()->withErrors(['error' => 'Error al obtener estado de OBS']);
        }
    }

    /**
     * Connect OBS clients
     */
    public function connectObs()
    {
        $user = Auth::user();
        $streamKey = $user->streamKey;
        $obsConfig = $user->obsConfiguration;

        if (!$streamKey) {
            return back()->withErrors(['error' => 'No se encontró stream key']);
        }

        if (!$obsConfig || !$obsConfig->is_active) {
            return back()->withErrors(['error' => 'No se encontró configuración OBS activa']);
        }

        try {
            $response = Http::withOptions([
                'verify' => false,
                'timeout' => 30
            ])->post(env('STREAMING_API_URL') . '/api/obs/connect', [
                'streamKey' => $streamKey->stream_key,
                'obsConfig' => [
                    'host' => $obsConfig->host,
                    'port' => $obsConfig->port,
                    'password' => $obsConfig->password
                ]
            ]);

            $data = $response->json();

            if ($data['ok'] ?? false) {
                return back()->with('success', $data['message'] ?? 'Conexión realizada correctamente');
            } else {
                return back()->withErrors(['error' => $data['message'] ?? 'Error en la conexión']);
            }

        } catch (\Exception $e) {
            Log::error('OBS connect failed', [
                'error' => $e->getMessage(),
                'user_id' => $user->id
            ]);

            return back()->withErrors(['error' => 'Error al conectar con OBS']);
        }
    }

    /**
     * Start OBS stream
     */
    public function startObsStream()
    {
        $user = Auth::user();
        $streamKey = $user->streamKey;

        if (!$streamKey) {
            return back()->withErrors(['error' => 'No se encontró stream key']);
        }

        try {
            $response = Http::withOptions([
                'verify' => false,
                'timeout' => 30
            ])->post(env('STREAMING_API_URL') . '/api/obs/command', [
                'streamKey' => $streamKey->stream_key,
                'action' => 'StartStream'
            ]);


            $data = $response->json();

            if ($data['ok'] ?? false) {
                return back()->with('success', 'Stream iniciado exitosamente');
            } else {
                return back()->withErrors(['error' => $data['message'] ?? 'Error al iniciar stream']);
            }

        } catch (\Exception $e) {
            Log::error('OBS start stream failed', [
                'error' => $e->getMessage(),
                'user_id' => $user->id
            ]);

            return back()->withErrors(['error' => 'Error al iniciar stream OBS']);
        }
    }

    /**
     * Stop OBS stream
     */
    public function stopObsStream()
    {
        $user = Auth::user();
        $streamKey = $user->streamKey;

        if (!$streamKey) {
            return back()->withErrors(['error' => 'No se encontró stream key']);
        }

        try {
            $response = Http::withOptions([
                'verify' => false,
                'timeout' => 30
            ])->post(env('STREAMING_API_URL') . '/api/obs/command', [
                'streamKey' => $streamKey->stream_key,
                'action' => 'StopStream'
            ]);


            $data = $response->json();

            if ($data['ok'] ?? false) {
                return back()->with('success', 'Stream detenido exitosamente');
            } else {
                return back()->withErrors(['error' => $data['message'] ?? 'Error al detener stream']);
            }

        } catch (\Exception $e) {
            Log::error('OBS stop stream failed', [
                'error' => $e->getMessage(),
                'user_id' => $user->id
            ]);

            return back()->withErrors(['error' => 'Error al detener stream OBS']);
        }
    }

    /**
     * Change OBS scene
     */
    public function changeObsScene(Request $request)
    {
        $request->validate([
            'clientId' => 'required|string',
            'sceneName' => 'required|string'
        ]);

        $user = Auth::user();
        $streamKey = $user->streamKey;

        if (!$streamKey) {
            return back()->withErrors(['error' => 'No se encontró stream key']);
        }

        try {
            $response = Http::withOptions([
                'verify' => false,
                'timeout' => 30
            ])->post(env('STREAMING_API_URL') . '/api/obs/command', [
                'streamKey' => $streamKey->stream_key,
                'clientId' => $request->clientId,
                'action' => 'SetCurrentProgramScene',
                'params' => [
                    'sceneName' => $request->sceneName
                ]
            ]);

            $data = $response->json();

            if ($data['ok'] ?? false) {
                return back()->with('success', 'Escena cambiada exitosamente');
            } else {
                return back()->withErrors(['error' => $data['message'] ?? 'Error al cambiar escena']);
            }

        } catch (\Exception $e) {
            Log::error('OBS scene change failed', [
                'error' => $e->getMessage(),
                'user_id' => $user->id,
                'client_id' => $request->clientId,
                'scene_name' => $request->sceneName
            ]);

            return back()->withErrors(['error' => 'Error al cambiar escena OBS']);
        }
    }

    /**
     * Execute custom OBS command
     */
    public function executeObsCommand(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'action' => 'required|string',
            'params' => 'sometimes|array'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Action is required'
            ], 400);
        }

        $user = Auth::user();
        $streamKey = $user->streamKey;

        if (!$streamKey) {
            return response()->json([
                'success' => false,
                'message' => 'No stream key found'
            ]);
        }

        try {
            $response = Http::withOptions([
                'verify' => false,
                'timeout' => 30
            ])->post(env('STREAMING_API_URL') . '/api/obs/command', [
                'streamKey' => $streamKey->stream_key,
                'action' => $request->action,
                'params' => $request->params ?? []
            ]);

            $data = $response->json();

            return response()->json([
                'success' => $data['ok'] ?? false,
                'message' => $data['message'] ?? 'Command executed',
                'obsResponse' => $data['obsResponse'] ?? null
            ]);

        } catch (\Exception $e) {
            Log::error('OBS command execution failed', [
                'error' => $e->getMessage(),
                'user_id' => $user->id,
                'action' => $request->action
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Error executing OBS command'
            ], 500);
        }
    }
}
