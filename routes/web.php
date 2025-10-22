<?php

use App\Http\Controllers\DashboardController;
use Illuminate\Http\Request; // Corregido: antes se usaba Illuminate\Http\Client\Request
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Http;
use Inertia\Inertia;
use App\Http\Controllers\VideoController;
use App\Http\Controllers\StreamKeyController;
use App\Http\Controllers\StreamController;
use App\Http\Controllers\StreamingToolController;
use App\Http\Controllers\ObsConfigurationController;
use App\Models\Video;

Route::get('/', function () {
    return Inertia::render('welcome');
})->name('home');

Route::get('/live', function (Request $request) {
    $key = $request->input('key');
    return Inertia::render('live', [
        'streamKey' => $key,
    ]);
})->name('live');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', [DashboardController::class, 'index'])->name('dashboard');
    Route::get('control', function () {
        $user = Auth::user();
        $streamKey = $user->streamKey;

        $streamStatus = [
            'isStreaming' => false,
            'exists' => false,
            'hasStreamKey' => (bool) $streamKey
        ];

        // Check stream status if user has a stream key
        if ($streamKey) {
            try {
                $response = Http::withOptions([
                    'verify' => false, // Disable SSL verification for development
                    'timeout' => 30
                ])->post(env('STREAMING_API_URL') . '/api/stream/status', [
                    'id' => (string) $user->id,
                    'clave_local' => $streamKey->stream_key
                ]);

                $data = $response->json();
                $streamStatus['isStreaming'] = $data['status']['isStreaming'] ?? false;
                $streamStatus['exists'] = $data['status']['exists'] ?? false;
            } catch (\Exception $e) {
                // Keep default values on error
            }
        }

        return Inertia::render('control', [
            'streamStatus' => $streamStatus
        ]);
    })->name('control');
    Route::get('fallback', function () {
        $userId = Auth::id();

        // Limpiar archivos huérfanos antes de mostrar la página
        VideoController::cleanOrphanedVideos($userId);

        $videos = Video::where('id_usuario', $userId)
            ->orderBy('created_at', 'desc')
            ->get();

        return Inertia::render('fallback', [
            'videos' => $videos
        ]);
    })->name('fallback');

    // Rutas API para videos
    Route::get('/api/videos', [VideoController::class, 'index'])->name('api.videos.index');
    Route::post('/api/videos', [VideoController::class, 'store'])->name('api.videos.store');
    Route::delete('/api/videos/{video}', [VideoController::class, 'destroy'])->name('api.videos.destroy');

    // Rutas API para stream keys
    Route::get('/api/stream-key', [StreamKeyController::class, 'show'])->name('api.stream-key.show');
    Route::post('/api/stream-key/generate', [StreamKeyController::class, 'generate'])->name('api.stream-key.generate');
    Route::post('/api/stream-key/regenerate', [StreamKeyController::class, 'regenerate'])->name('api.stream-key.regenerate');

    // Rutas API para control de stream
    Route::get('/api/stream/status', [StreamController::class, 'ObtenerStatus'])->name('api.stream.status');
    Route::post('/api/stream/start', [StreamController::class, 'IniciarRetransmision'])->name('api.stream.start');
    Route::post('/api/stream/stop', [StreamController::class, 'DetenerRetransmision'])->name('api.stream.stop');

    // Rutas para OBS Configuration
    Route::get('/api/obs-config', [ObsConfigurationController::class, 'MostrarOBSConfiguracion'])->name('api.obs-config.show');
    Route::post('/api/obs-config', [ObsConfigurationController::class, 'GuardarConfiguracion'])->name('api.obs-config.store');
    Route::delete('/api/obs-config', [ObsConfigurationController::class, 'EliminarObsConfiguracion'])->name('api.obs-config.destroy');
    Route::patch('/api/obs-config/toggle', [ObsConfigurationController::class, 'toggle'])->name('api.obs-config.toggle');

    // Rutas para Streaming Tool y OBS Control
    Route::match(['GET', 'POST'], '/api/obs/status', [StreamingToolController::class, 'getObsStatus'])->name('api.obs.status');
    Route::post('/api/obs/connect', [StreamingToolController::class, 'connectObs'])->name('api.obs.connect');
    Route::post('/api/obs/start-stream', [StreamingToolController::class, 'startObsStream'])->name('api.obs.start-stream');
    Route::post('/api/obs/stop-stream', [StreamingToolController::class, 'stopObsStream'])->name('api.obs.stop-stream');
    Route::post('/api/obs/change-scene', [StreamingToolController::class, 'changeObsScene'])->name('api.obs.change-scene');
    Route::post('/api/obs/command', [StreamingToolController::class, 'executeObsCommand'])->name('api.obs.command');

    Route::get('streamingtool', [StreamingToolController::class, 'index'])->name('streamingtool');

    Route::get('configuracion', function () {
        $user = Auth::user();
        $streamKey = $user->streamKey;
        $obsConfig = $user->obsConfiguration;

        return Inertia::render('configuracion', [
            'streamKey' => $streamKey ? [
                'stream_key' => $streamKey->stream_key,
                'is_active' => $streamKey->is_active
            ] : null,
            'obsConfig' => $obsConfig ? [
                'host' => $obsConfig->host,
                'port' => $obsConfig->port,
                'is_active' => $obsConfig->is_active
            ] : null
        ]);
    })->name('configuracion');

    // Admin routes - panel and APIs (requires isadmin middleware)
    Route::middleware(['isadmin'])->group(function () {
        Route::get('/admin', [\App\Http\Controllers\AdminController::class, 'index'])->name('admin.index');
        // Server route to render the Inertia users page (prevents 404 on direct navigation)
        Route::get('/admin/users', function () {
            return Inertia::render('admin/users');
        })->name('admin.users');
        // Admin users API (simple endpoints)
        Route::get('/api/admin/users', [\App\Http\Controllers\AdminUserController::class, 'index'])->name('api.admin.users.index');
        Route::patch('/api/admin/users/{id}/toggle', [\App\Http\Controllers\AdminUserController::class, 'toggleActive'])->name('api.admin.users.toggle');
        Route::patch('/api/admin/users/{id}/license', [\App\Http\Controllers\AdminUserController::class, 'activateLicense'])->name('api.admin.users.license');
    Route::patch('/api/admin/users/{id}/license/toggle', [\App\Http\Controllers\AdminUserController::class, 'toggleLicense'])->name('api.admin.users.license.toggle');
    Route::patch('/api/admin/users/{id}/license', [\App\Http\Controllers\AdminUserController::class, 'updateLicense'])->name('api.admin.users.license.update');
    });

    // Rutas para el controlador de streaming tool
    Route::post('/streaming-tool/start-obs-stream', [StreamingToolController::class, 'startObsStream'])
        ->name('streaming-tool.start-obs-stream');
    Route::post('/streaming-tool/stop-obs-stream', [StreamingToolController::class, 'stopObsStream'])
        ->name('streaming-tool.stop-obs-stream');
    Route::post('/streaming-tool/change-obs-scene', [StreamingToolController::class, 'changeObsScene'])
        ->name('streaming-tool.change-obs-scene');
});

require __DIR__ . '/settings.php';
require __DIR__ . '/auth.php';
