<?php

namespace App\Http\Controllers;

use App\Models\Video;
use App\Http\Controllers\StreamController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use FFMpeg\FFMpeg;
use FFMpeg\Format\Video\X264;

class VideoController extends Controller
{
    public function index()
    {

        $videos = Video::where('id_usuario', Auth::id())
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json($videos);
    }

    public function store(Request $request)
    {
        try {
            $file = $request->file('video');
            if ($file) {
                Log::info('Video file received', [
                    'name' => $file->getClientOriginalName(),
                    'size' => $file->getSize(),
                    'mime' => $file->getMimeType(),
                    'error' => $file->getError()
                ]);
            }

            $request->validate([
                'video' => 'required|file|mimes:mp4,avi,mov,mkv,wmv,flv,webm|max:512000' // 50MB en KB
            ],[
                'video.required' => 'El archivo de video es obligatorio.',
                'video.mimes' => 'El archivo debe ser un video en formato MP4, AVI, MOV, MKV, WMV, FLV o WEBM.',
                'video.max' => 'El archivo de video no puede superar los 512MB.'
            ]);

            if (!$file || !$file->isValid()) {
                $error = $file ? $file->getErrorMessage() : 'No file received';
                Log::error('Invalid file upload: ' . $error);
                return back()->withErrors(['video' => 'Archivo inválido: ' . $error]);
            }

            $userId = Auth::id();
            $userDir = "{$userId}/videos_de_corte";
            if (!Storage::exists($userDir)) {
                Storage::makeDirectory($userDir);
            }

            $originalName = $file->getClientOriginalName();
            $filename = time().'_'.str_replace(' ', '_', $originalName);
            $mp4Filename = pathinfo($filename, PATHINFO_FILENAME).'.mp4';

            $tempPath = $file->store('temp', 'public');
            $fullTempPath = storage_path('app/public/' . $tempPath);
            $finalPath = "{$userDir}/{$mp4Filename}";
            $fullFinalPath = public_path('storage/' . $finalPath);

            Log::info('File paths', [
                'temp' => $fullTempPath,
                'final' => $fullFinalPath
            ]);

            try {
                $this->convertToMp4($fullTempPath, $fullFinalPath);

                if (file_exists($fullTempPath)) {
                    unlink($fullTempPath);
                }

                $video = Video::create([
                    'id_usuario' => $userId,
                    'ruta' => str_replace('public/', '', $finalPath),
                    'nombre_original' => $originalName,
                    'mime_type' => 'video/mp4',
                    'tamaño' => filesize($fullFinalPath)
                ]);

                StreamController::detenerStreamSecond(Auth::user());

                $videos = Video::where('id_usuario', $userId)
                    ->orderBy('created_at', 'desc')
                    ->get();

                return back()->with([
                    'success' => 'Video subido correctamente',
                    'videos' => $videos
                ]);

            } catch (\Exception $e) {
                // Limpiar archivos en caso de error
                if (file_exists($fullTempPath)) {
                    unlink($fullTempPath);
                }
                if (file_exists($fullFinalPath)) {
                    unlink($fullFinalPath);
                }

                Log::error('Error procesando video: ' . $e->getMessage());
                return back()->withErrors(['video' => 'Error procesando el video: ' . $e->getMessage()]);
            }

        } catch (\Illuminate\Validation\ValidationException $e) {
            Log::error('Validation error', $e->errors());
            return back()->withErrors($e->errors());
        } catch (\Exception $e) {
            Log::error('Error general en store: ' . $e->getMessage());
            return back()->withErrors(['video' => 'Error interno del servidor']);
        }
    }

    private function convertToMp4(string $inputPath, string $outputPath): void
    {
        $dir = dirname($outputPath);
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }

        try {
            $ffmpeg = FFMpeg::create([
                'ffmpeg.binaries'  => 'ffmpeg', // ruta del binario ffmpeg
                'ffprobe.binaries' => 'ffprobe', // ruta del binario ffprobe
                'timeout'          => 300, // timeout en segundos
                'ffmpeg.threads'   => 12, // número de threads
            ]);

            $video = $ffmpeg->open($inputPath);

            $format = new X264();
            $format->setKiloBitrate(1000) // bitrate de video
                ->setAudioCodec("aac")  // codec de audio
                ->setAudioKiloBitrate(128); // bitrate de audio

            if (file_exists($outputPath)) {
                unlink($outputPath);
            }

            $video->save($format, $outputPath);

        } catch (\Exception $e) {
            throw new \Exception('Error al convertir el video: ' . $e->getMessage());
        }
    }

    public function destroy(Video $video)
    {
        if ($video->id_usuario !== Auth::id()) {
            return back()->withErrors(['error' => 'No autorizado']);
        }

        try {
            $filePath = "public/{$video->ruta}";
            if (Storage::exists($filePath)) {
                Storage::delete($filePath);
            }

            $video->delete();

            StreamController::detenerStreamSecond(Auth::user());

            return back()->with('success', 'Video eliminado correctamente');
        } catch (\Exception $e) {
            Log::error('Error eliminando video: ' . $e->getMessage());
            return back()->withErrors(['error' => 'Error eliminando el video']);
        }
    }


    public static function cleanOrphanedVideos($userId)
    {
        try {
            $userVideoDir = "{$userId}/videos_de_corte";

            if (!Storage::disk('public')->exists($userVideoDir)) {
                return;
            }

            $physicalFiles = Storage::disk('public')->files($userVideoDir);

            $dbVideoPaths = Video::where('id_usuario', $userId)
                ->pluck('ruta')
                ->toArray();

            $orphanedFiles = array_diff($physicalFiles, $dbVideoPaths);

            $deletedCount = 0;
            foreach ($orphanedFiles as $orphanedFile) {
                $extension = strtolower(pathinfo($orphanedFile, PATHINFO_EXTENSION));
                $videoExtensions = ['mp4', 'avi', 'mov', 'mkv', 'wmv', 'flv', 'webm'];

                if (in_array($extension, $videoExtensions)) {
                    if (Storage::disk('public')->delete($orphanedFile)) {
                        $deletedCount++;
                        Log::info("Deleted orphaned video file", [
                            'user_id' => $userId,
                            'file' => $orphanedFile
                        ]);
                    }
                }
            }

            if ($deletedCount > 0) {
                Log::info("Cleaned orphaned videos", [
                    'user_id' => $userId,
                    'deleted_count' => $deletedCount
                ]);
            }

        } catch (\Exception $e) {
            Log::error('Error cleaning orphaned videos', [
                'user_id' => $userId,
                'error' => $e->getMessage()
            ]);
        }
    }
}
