<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\User;
use App\Models\Licencia;
use Illuminate\Http\JsonResponse;

use Inertia\Inertia;
use Carbon\Carbon;

class AdminUserController extends Controller
{
    /**
     * Helper to return errors compatible with Inertia when needed.
     */
    protected function errorResponse(Request $request, string $message, string $field = 'vencimiento', int $status = 422)
    {
        if ($request->header('X-Inertia')) {
            // For Inertia requests return a redirect back with errors so the Inertia client
            // receives a location response and can display validation errors properly.
            return redirect()->back()->withErrors([$field => $message])->withInput();
        }

        return response()->json(['message' => $message], $status);
    }

    public function index(Request $request)
    {
        $users = User::with('licencia')->orderBy('id', 'desc')->get();
        // If this is an Inertia request, return the admin users page via Inertia
        if ($request->header('X-Inertia')) {
            return Inertia::render('admin/users', [
                'users' => $users,
            ]);
        }

        return response()->json(['users' => $users]);
    }

    public function toggleActive(Request $request, $id)
    {
        $user = User::find($id);
        if (!$user) {
            return response()->json(['message' => 'Usuario no encontrado'], 404);
        }

        $user->active = !$user->active;
        $user->save();

        if ($request->header('X-Inertia')) {
            return redirect()->route('admin.users');
        }

        return response()->json(['user' => $user]);
    }

    public function activateLicense(Request $request, $id)
    {
        $user = User::find($id);
        if (!$user) {
            return response()->json(['message' => 'Usuario no encontrado'], 404);
        }

        $lic = Licencia::where('user_id', $user->id)->first();

        if ($lic) {
            $lic->active = true;
            $lic->save();
        } else {
            $lic = Licencia::create([
                'user_id' => $user->id,
                'active' => true,
                'tipo' => 'paid',
            ]);
        }

        $user->load('licencia');

        if ($request->header('X-Inertia')) {
            return redirect()->route('admin.users');
        }

        return response()->json(['user' => $user]);
    }

    /**
     * Toggle license active/inactive for a user (independent per license).
     */
    public function toggleLicense(Request $request, $id)
    {
        $user = User::find($id);
        if (!$user) {
            return response()->json(['message' => 'Usuario no encontrado'], 404);
        }

        // allow passing a vencimiento when activating
        $vencimiento = $request->input('vencimiento');

        $lic = Licencia::where('user_id', $user->id)->first();

        if (!$lic) {
            // If creating and no vencimiento provided, reject
            if (!$vencimiento) {
                return $this->errorResponse($request, 'Se requiere fecha de vencimiento al activar la licencia');
            }

            // validate date format
            if ($vencimiento && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $vencimiento)) {
                return $this->errorResponse($request, 'Formato de fecha inválido. Use YYYY-MM-DD');
            }

            // ensure vencimiento is not in the past
            if ($vencimiento) {
                $vDate = Carbon::parse($vencimiento);
                if ($vDate->lt(Carbon::today())) {
                    return $this->errorResponse($request, 'La fecha de vencimiento ya está vencida');
                }
            }

            $lic = Licencia::create([
                'user_id' => $user->id,
                'active' => true,
                'tipo' => 'paid',
                'vencimiento' => $vencimiento,
            ]);
        } else {
            // toggle active state
            $lic->active = !$lic->active;

            // if activating, require vencimiento (either existing or passed)
            if ($lic->active) {
                $v = $vencimiento ?? $lic->vencimiento;
                if (!$v) {
                    return $this->errorResponse($request, 'Se requiere fecha de vencimiento al activar la licencia');
                }
                // validate and ensure not expired
                if ($vencimiento && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $vencimiento)) {
                    return $this->errorResponse($request, 'Formato de fecha inválido. Use YYYY-MM-DD');
                }
                $vDate = $vencimiento ? Carbon::parse($vencimiento) : Carbon::parse($lic->vencimiento);
                if ($vDate->lt(Carbon::today())) {
                    return $this->errorResponse($request, 'La fecha de vencimiento ya está vencida');
                }
                $lic->vencimiento = $vencimiento ?? $lic->vencimiento;
            } else {
                // when deactivating license, clear features
                $lic->retransmision = false;
                $lic->controlremoto = false;
                $lic->videosfallback = false;
            }

            $lic->save();
        }

        $user->load('licencia');

        if ($request->header('X-Inertia')) {
            return redirect()->route('admin.users');
        }

        return response()->json(['user' => $user]);
    }

    /**
     * Update specific license feature and expiration.
     * Accepts: feature (string), active (bool), vencimiento (nullable date), tipo (optional)
     */
    public function updateLicense(Request $request, $id)
    {
        $user = User::find($id);
        if (!$user) {
            return response()->json(['message' => 'Usuario no encontrado'], 404);
        }

        $feature = $request->input('feature');
        $active = $request->input('active');
        $vencimiento = $request->input('vencimiento');
        $tipo = $request->input('tipo');

        $lic = Licencia::where('user_id', $user->id)->first();
        if (!$lic) {
            $lic = Licencia::create([
                'user_id' => $user->id,
                'active' => false,
                'tipo' => $tipo ?? 'paid',
            ]);
        }

        // Update feature
        if ($feature && in_array($feature, ['retransmision', 'controlremoto', 'videosfallback'])) {
            // Features can only be toggled if the overall license is active
            if (!$lic->active) {
                return $this->errorResponse($request, 'No se pueden activar características porque la licencia está inactiva', 'feature');
            }

            // Prevent activating features if vencimiento is expired
            if ($lic->vencimiento && Carbon::parse($lic->vencimiento)->lt(Carbon::today()) && (bool)$active) {
                return $this->errorResponse($request, 'La licencia está vencida y no se pueden activar características', 'feature');
            }

            $lic->{$feature} = (bool) $active;
        }

        // Update tipo if provided
        if ($tipo) {
            $lic->tipo = $tipo;
        }

        // Update vencimiento if provided (allow null). Validate format if non-null
        if ($vencimiento !== null) {
            if ($vencimiento && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $vencimiento)) {
                return $this->errorResponse($request, 'Formato de fecha inválido. Use YYYY-MM-DD');
            }
            $lic->vencimiento = $vencimiento ? $vencimiento : null;
        }

        // If any feature active or tipo set then mark licencia active
        $lic->active = (bool) $lic->retransmision || (bool) $lic->controlremoto || (bool) $lic->videosfallback || ($lic->tipo !== 'free');

        $lic->save();

        $user->load('licencia');
        if ($request->header('X-Inertia')) {
            return redirect()->route('admin.users');
        }

        return response()->json(['user' => $user]);
    }
}
