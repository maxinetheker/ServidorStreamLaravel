<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use App\Models\ObsConfiguration;

class ObsConfigurationController extends Controller
{
    /**
     * Store or update OBS configuration
     */
    public function GuardarConfiguracion(Request $request): RedirectResponse
    {
        $request->validate([
            'host' => 'required|string|max:255',
            'port' => 'required|integer|min:1|max:65535',
            'password' => 'required|string|min:1|max:255'
        ]);

        $user = Auth::user();

        try {
            $obsConfig = ObsConfiguration::updateOrCreate(
                ['user_id' => $user->id],
                [
                    'host' => $request->host,
                    'port' => $request->port,
                    'password' => $request->password,
                    'is_active' => true
                ]
            );

            return back()->with([
                'success' => 'Configuración OBS guardada correctamente',
                'obsConfigData' => [
                    'host' => $obsConfig->host,
                    'port' => $obsConfig->port,
                    'is_active' => $obsConfig->is_active
                ]
            ]);

        } catch (\Exception $e) {
            return back()->withErrors(['error' => 'Error al guardar la configuración OBS']);
        }
    }

    /**
     * Get OBS configuration
     */
    public function MostrarOBSConfiguracion(): JsonResponse
    {
        $user = Auth::user();
        $obsConfig = $user->obsConfiguration;

        if (!$obsConfig) {
            return response()->json([
                'success' => false,
                'message' => 'No OBS configuration found',
                'config' => null
            ]);
        }

        return response()->json([
            'success' => true,
            'config' => [
                'host' => $obsConfig->host,
                'port' => $obsConfig->port,
                'is_active' => $obsConfig->is_active
            ]
        ]);
    }

    /**
     * Delete OBS configuration
     */
    public function EliminarObsConfiguracion(): RedirectResponse
    {
        $user = Auth::user();
        $obsConfig = $user->obsConfiguration;

        if (!$obsConfig) {
            return back()->withErrors(['error' => 'No se encontró configuración OBS']);
        }

        try {
            $obsConfig->delete();
            return back()->with('success', 'Configuración OBS eliminada correctamente');

        } catch (\Exception $e) {
            return back()->withErrors(['error' => 'Error al eliminar la configuración OBS']);
        }
    }

    /**
     * Toggle OBS configuration active status
     */
    public function toggle(): JsonResponse
    {
        $user = Auth::user();
        $obsConfig = $user->obsConfiguration;

        if (!$obsConfig) {
            return response()->json([
                'success' => false,
                'message' => 'No OBS configuration found'
            ]);
        }

        try {
            $obsConfig->is_active = !$obsConfig->is_active;
            $obsConfig->save();

            return response()->json([
                'success' => true,
                'message' => 'OBS configuration status updated',
                'config' => [
                    'host' => $obsConfig->host,
                    'port' => $obsConfig->port,
                    'is_active' => $obsConfig->is_active
                ]
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error updating OBS configuration'
            ], 500);
        }
    }
}
