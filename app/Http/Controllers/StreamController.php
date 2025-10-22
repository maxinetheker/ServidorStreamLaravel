<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use App\Models\Video;

class StreamController extends Controller
{
    /**
     * Get the current stream status
     */
    public function ObtenerStatus(): JsonResponse
    {
        $user = Auth::user();
        $streamKey = $user->streamKey;

        if (!$streamKey) {
            return response()->json([
                'success' => false,
                'message' => 'No stream key found',
                'isStreaming' => false
            ]);
        }

        try {
            $response = Http::withOptions([
                'verify' => false, // Disable SSL verification for development
                'timeout' => 30
            ])->get(env('STREAMING_API_URL') . '/api/stream/status/' . $user->id);

            $data = $response->json();

            return response()->json([
                'success' => $data['ok'] ?? true,
                'isStreaming' => $data['streaming'] ?? false,
                'exists' => $data['exists'] ?? false
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error checking stream status',
                'isStreaming' => false
            ], 500);
        }
    }

    /**
     * Start the stream
     */
    public function IniciarRetransmision(Request $request)
    {
        Log::info('Stream start request received', ['user_id' => Auth::id()]);

        $user = Auth::user();
        $streamKey = $user->streamKey;

        if (!$streamKey) {
            Log::error('No stream key found for user', ['user_id' => $user->id]);

            if ($request->wantsJson()) {
                return response()->json([
                    'success' => false,
                    'message' => 'No stream key found'
                ], 400);
            }

            return back()->withErrors(['error' => 'No stream key found']);
        }

        // Get user's videos - convert to full file system paths
        $videos = Video::where('id_usuario', $user->id)
            ->get()
            ->map(function ($video) {
                // Convert from storage path to full storage path
                // From: "1/videos_de_corte/filename.mp4"
                // To: "storage/1/videos_de_corte/filename.mp4"
                return "storage/" . $video->ruta;
            })
            ->toArray();

        Log::info('Starting stream', [
            'user_id' => $user->id,
            'videos_count' => count($videos),
            'stream_key_exists' => !empty($streamKey->stream_key),
            'videos_paths' => $videos
        ]);

        try {
            // First notify the Node.js server to prepare the stream
            $response = Http::withOptions([
                'verify' => false,
                'timeout' => 30
            ])->post(env('STREAMING_API_URL') . '/api/stream/prepare', [
                'id' => (string) $user->id,
                'clave_local' => $streamKey->stream_key,
                'lista_videos' => $videos
            ]);

            $prepareData = $response->json();

            if (!$prepareData['ok']) {
                Log::warning('Stream preparation failed', ['response' => $prepareData]);

                if ($request->wantsJson()) {
                    return response()->json([
                        'success' => false,
                        'message' => $prepareData['message'] ?? 'Failed to prepare stream'
                    ]);
                }

                return back()->withErrors(['error' => $prepareData['message'] ?? 'Failed to prepare stream']);
            }

            // Now start the actual stream
            $response = Http::withOptions([
                'verify' => false,
                'timeout' => 30
            ])->post(env('STREAMING_API_URL') . '/api/stream/start', [
                'id' => (string) $user->id,
                'clave_local' => $streamKey->stream_key,
                'señal' => 1,
                'lista_videos' => $videos
            ]);

            $data = $response->json();

            Log::info('Stream API response', [
                'status_code' => $response->status(),
                'response_data' => $data
            ]);

            if ($data['ok'] && $data['success']) {
                if ($request->wantsJson()) {
                    return response()->json([
                        'success' => true,
                        'message' => $data['message'],
                        'streamKey' => $streamKey->stream_key
                    ]);
                }

                return back()->with('success', $data['message']);
            } else {
                Log::warning('Stream start failed', ['response' => $data]);

                if ($request->wantsJson()) {
                    return response()->json([
                        'success' => false,
                        'message' => $data['message'] ?? 'Failed to start stream'
                    ]);
                }

                return back()->withErrors(['error' => $data['message'] ?? 'Failed to start stream']);
            }

        } catch (\Exception $e) {
            Log::error('Stream start exception', [
                'error' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine()
            ]);

            if ($request->wantsJson()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Error starting stream: ' . $e->getMessage()
                ], 500);
            }

            return back()->withErrors(['error' => 'Error starting stream']);
        }
    }

    /**
     * Stop the stream
     */
    public function DetenerRetransmision(Request $request)
    {
        Log::info('Stream stop request received', ['user_id' => Auth::id()]);

        $user = Auth::user();
        $streamKey = $user->streamKey;

        if (!$streamKey) {
            Log::error('No stream key found for user during stop', ['user_id' => $user->id]);

            if ($request->wantsJson()) {
                return response()->json([
                    'success' => false,
                    'message' => 'No stream key found'
                ], 400);
            }

            return back()->withErrors(['error' => 'No stream key found']);
        }

        Log::info('Stopping stream', [
            'user_id' => $user->id,
            'stream_key_exists' => !empty($streamKey->stream_key)
        ]);

        try {
            $response = Http::withOptions([
                'verify' => false, // Disable SSL verification for development
                'timeout' => 30
            ])->post(env('STREAMING_API_URL') . '/api/stream/stop', [
                'id' => (int) $user->id,
                'clave_local' => $streamKey->stream_key,
                'señal' => 0
            ]);

            $data = $response->json();

            Log::info('Stream stop API response', [
                'status_code' => $response->status(),
                'response_data' => $data
            ]);

            if ($data['ok'] && $data['success']) {
                if ($request->wantsJson()) {
                    return response()->json([
                        'success' => true,
                        'message' => $data['message']
                    ]);
                }

                return back()->with('success', $data['message']);
            } else {
                Log::warning('Stream stop failed', ['response' => $data]);

                if ($request->wantsJson()) {
                    return response()->json([
                        'success' => false,
                        'message' => $data['message'] ?? 'Failed to stop stream'
                    ]);
                }

                return back()->withErrors(['error' => $data['message'] ?? 'Failed to stop stream']);
            }

        } catch (\Exception $e) {
            Log::error('Stream stop exception', [
                'error' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine()
            ]);

            if ($request->wantsJson()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Error stopping stream: ' . $e->getMessage()
                ], 500);
            }

            return back()->withErrors(['error' => 'Error stopping stream']);
        }
    }

    /**
     * Stop stream silently (used internally when videos/keys change)
     */
    public static function detenerStreamSecond($user)
    {
        $streamKey = $user->streamKey;

        if (!$streamKey) {
            return false;
        }

        try {
            $response = Http::withOptions([
                'verify' => false,
                'timeout' => 30
            ])->post(env('STREAMING_API_URL') . '/api/stream/stop', [
                'id' => (int) $user->id,
                'clave_local' => $streamKey->stream_key,
                'señal' => 0
            ]);

            $data = $response->json();

            Log::info('Stream stopped silently due to content change', [
                'user_id' => $user->id,
                'response' => $data
            ]);

            return $data['ok'] && $data['success'];
        } catch (\Exception $e) {
            Log::error('Error stopping stream silently', [
                'user_id' => $user->id,
                'error' => $e->getMessage()
            ]);
            return false;
        }
    }
}
