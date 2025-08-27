<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Video;
use App\Models\StreamKey;
use App\Models\ObsConfiguration;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Carbon\Carbon;

class DashboardController extends Controller
{
    public function index()
    {
        $user = Auth::user();

        // Cargar relaciones
        $user->load(['videos', 'streamKey', 'obsConfiguration']);

        // Obtener estadísticas reales del usuario basadas en las tablas existentes
        $userStats = $this->getUserStats($user);

        // Obtener datos para gráficos basados en videos del usuario
        $weeklyActivity = $this->getWeeklyVideoActivity($user);
        $videosByType = $this->getVideosByType($user);

        // Obtener actividad reciente
        $recentActivity = $this->getRecentActivity($user);

        // Estado de OBS
        $obsStatus = $this->getObsStatus($user);
        
        // Estado del Stream de la plataforma (separado de OBS)
        $streamStatus = $this->getStreamStatus($user);

        // Información del stream key
        $streamInfo = $this->getStreamInfo($user);

        return Inertia::render('dashboard', [
            'userStats' => $userStats,
            'weeklyActivity' => $weeklyActivity,
            'videosByType' => $videosByType,
            'recentActivity' => $recentActivity,
            'obsStatus' => $obsStatus,
            'streamStatus' => $streamStatus,
            'streamInfo' => $streamInfo,
        ]);
    }

    private function getUserStats(User $user)
    {
        // Estadísticas basadas en videos del usuario
        $totalVideos = $user->videos()->count();

        // Calcular tamaño total de videos en MB
        $totalSize = $user->videos()->sum('tamaño') / (1024 * 1024); // Convertir a MB

        // Videos subidos esta semana
        $videosThisWeek = $user->videos()
            ->where('created_at', '>=', Carbon::now()->startOfWeek())
            ->count();

        // Videos subidos este mes
        $videosThisMonth = $user->videos()
            ->where('created_at', '>=', Carbon::now()->startOfMonth())
            ->count();

        return [
            'totalVideos' => $totalVideos,
            'totalSizeMB' => round($totalSize, 2),
            'videosThisWeek' => $videosThisWeek,
            'videosThisMonth' => $videosThisMonth,
            'hasStreamKey' => $user->streamKey !== null,
            'obsConfigured' => $user->obsConfiguration !== null,
        ];
    }

    private function getWeeklyVideoActivity(User $user)
    {
        $weekData = [];
        $labels = [];
        $videosCount = [];
        $sizeMB = [];

        for ($i = 6; $i >= 0; $i--) {
            $date = Carbon::now()->subDays($i);
            $labels[] = $date->locale('es')->format('D');

            // Videos subidos por día
            $dailyVideos = $user->videos()
                ->whereDate('created_at', $date->format('Y-m-d'))
                ->get();

            $videosCount[] = $dailyVideos->count();

            // Tamaño total en MB por día
            $dailySize = $dailyVideos->sum('tamaño') / (1024 * 1024);
            $sizeMB[] = round($dailySize, 2);
        }

        return [
            'labels' => $labels,
            'videosCount' => $videosCount,
            'sizeMB' => $sizeMB,
        ];
    }

    private function getVideosByType(User $user)
    {
        // Agrupar videos por tipo MIME
        $videosByMime = $user->videos()
            ->select('mime_type', DB::raw('count(*) as total'))
            ->groupBy('mime_type')
            ->pluck('total', 'mime_type')
            ->toArray();

        // Convertir tipos MIME a nombres más amigables
        $friendlyTypes = [];
        foreach ($videosByMime as $mimeType => $count) {
            switch ($mimeType) {
                case 'video/mp4':
                    $friendlyTypes['MP4'] = $count;
                    break;
                case 'video/webm':
                    $friendlyTypes['WebM'] = $count;
                    break;
                case 'video/mov':
                case 'video/quicktime':
                    $friendlyTypes['MOV'] = ($friendlyTypes['MOV'] ?? 0) + $count;
                    break;
                case 'video/avi':
                    $friendlyTypes['AVI'] = $count;
                    break;
                default:
                    $friendlyTypes['Otros'] = ($friendlyTypes['Otros'] ?? 0) + $count;
                    break;
            }
        }

        return $friendlyTypes;
    }

    private function getRecentActivity(User $user)
    {
        $activities = [];

        // Últimos videos subidos
        $recentVideos = $user->videos()
            ->orderBy('created_at', 'desc')
            ->limit(5)
            ->get();

        foreach ($recentVideos as $video) {
            $activities[] = [
                'type' => 'video',
                'title' => 'Video subido',
                'description' => $video->nombre_original ?: 'Video sin título',
                'time' => $video->created_at->diffForHumans(),
                'color' => 'blue',
                'size' => $this->formatFileSize($video->tamaño),
            ];
        }

        // Stream key generado/actualizado
        if ($user->streamKey) {
            $activities[] = [
                'type' => 'stream_key',
                'title' => 'Stream Key configurado',
                'description' => 'Stream key activo y listo para usar',
                'time' => $user->streamKey->created_at->diffForHumans(),
                'color' => 'green',
            ];
        }

        // Configuración OBS
        if ($user->obsConfiguration) {
            $activities[] = [
                'type' => 'obs',
                'title' => 'OBS configurado',
                'description' => "Puerto: {$user->obsConfiguration->port}",
                'time' => $user->obsConfiguration->updated_at->diffForHumans(),
                'color' => 'purple',
            ];
        }

        // Ordenar por fecha más reciente
        usort($activities, function ($a, $b) {
            return strtotime($b['time']) - strtotime($a['time']);
        });

        return array_slice($activities, 0, 5);
    }

    private function getObsStatus(User $user)
    {
        $obsConfig = $user->obsConfiguration;
        $streamKey = $user->streamKey;
        
        $obsData = [
            'configured' => $obsConfig !== null,
            'host' => $obsConfig?->host ?? 'localhost',
            'port' => $obsConfig?->port ?? 4455,
            'isActive' => $obsConfig?->is_active ?? false,
            'hasPassword' => $obsConfig && !empty($obsConfig->password),
            'clients' => [],
            'clientCount' => 0
        ];

        // Obtener datos de clientes OBS conectados únicamente
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
                if ($response->successful() && $data) {
                    $obsData['clients'] = $data['clients'] ?? [];
                    $obsData['clientCount'] = count($obsData['clients']);
                }
            } catch (\Exception $e) {
                // Silently handle error, keeping default values
            }
        }

        return $obsData;
    }

    private function getStreamStatus(User $user)
    {
        $streamKey = $user->streamKey;
        
        $streamData = [
            'isStreaming' => false,
            'exists' => false
        ];

        // Obtener estado del stream de la plataforma usando la misma lógica que StreamController
        if ($streamKey) {
            try {
                $response = Http::withOptions([
                    'verify' => false,
                    'timeout' => 30
                ])->post(env('STREAMING_API_URL') . '/api/stream/status', [
                    'id' => (string) $user->id,
                    'clave_local' => $streamKey->stream_key
                ]);

                $data = $response->json();
                if ($response->successful() && $data) {
                    $streamData['isStreaming'] = $data['status']['isStreaming'] ?? false;
                    $streamData['exists'] = $data['status']['exists'] ?? false;
                }
            } catch (\Exception $e) {
                // Silently handle error, keeping default values
            }
        }

        return $streamData;
    }

    private function getStreamInfo(User $user)
    {
        $streamKey = $user->streamKey;

        return [
            'hasStreamKey' => $streamKey !== null,
            'streamKey' => $streamKey?->stream_key,
            'isActive' => $streamKey?->is_active ?? false,
            'rtmpServer' => env('RTMP_SERVER', 'rtmp://192.168.2.212:1935/live'),
            'createdAt' => $streamKey?->created_at?->diffForHumans(),
        ];
    }

    private function formatFileSize($bytes)
    {
        if ($bytes == 0) return '0 B';

        $units = ['B', 'KB', 'MB', 'GB'];
        $factor = floor(log($bytes, 1024));

        return sprintf("%.2f %s", $bytes / pow(1024, $factor), $units[$factor]);
    }

    public function generateStreamKey()
    {
        $user = Auth::user();

        // Si ya tiene stream key, actualizarlo
        if ($user->streamKey) {
            $user->streamKey->update([
                'stream_key' => StreamKey::generateStreamKey(),
                'is_active' => true,
            ]);
        } else {
            // Crear nuevo stream key
            StreamKey::create([
                'user_id' => $user->id,
                'stream_key' => StreamKey::generateStreamKey(),
                'is_active' => true,
            ]);
        }

        return response()->json([
            'success' => true,
            'message' => 'Stream key generado exitosamente',
        ]);
    }

    public function toggleStreamKey()
    {
        $user = Auth::user();

        if ($user->streamKey) {
            $user->streamKey->update([
                'is_active' => !$user->streamKey->is_active
            ]);

            return response()->json([
                'success' => true,
                'is_active' => $user->streamKey->is_active,
                'message' => $user->streamKey->is_active ? 'Stream key activado' : 'Stream key desactivado',
            ]);
        }

        return response()->json([
            'success' => false,
            'message' => 'No tienes un stream key configurado',
        ], 404);
    }
}
