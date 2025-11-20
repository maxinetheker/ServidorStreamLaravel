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
     * Helper para retornar errores compatibles con Inertia cuando sea necesario.
     */
    protected function errorResponse(Request $request, string $message, string $field = 'vencimiento', int $status = 422)
    {
        if ($request->header('X-Inertia')) {
 
            return redirect()->back()->withErrors([$field => $message])->withInput();
        }

        return response()->json(['message' => $message], $status);
    }

    public function index(Request $request)
    {
        $users = User::with('licencia')->orderBy('id', 'desc')->get();
        // Si es una petición Inertia, renderizar la vista correspondiente
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
     * Cambiar estado de la licencia (activa/inactiva) para un usuario (independiente por licencia).
     */
    public function toggleLicense(Request $request, $id)
    {
        $user = User::find($id);
        if (!$user) {
            return response()->json(['message' => 'Usuario no encontrado'], 404);
        }

        $vencimiento = $request->input('vencimiento');

        $lic = Licencia::where('user_id', $user->id)->first();

        if (!$lic) {
          
            if (!$vencimiento) {
                return $this->errorResponse($request, 'Se requiere fecha de vencimiento al activar la licencia');
            }

            // validar formato de vencimiento
            if ($vencimiento && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $vencimiento)) {
                return $this->errorResponse($request, 'Formato de fecha inválido. Use YYYY-MM-DD');
            }

            // asegurar que la fecha de vencimiento no esté en el pasado
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
            // cambio de estado activo/inactivo
            $lic->active = !$lic->active;

            // si se activa, se requiere vencimiento (ya sea existente o pasado)
            if ($lic->active) {
                $v = $vencimiento ?? $lic->vencimiento;
                if (!$v) {
                    return $this->errorResponse($request, 'Se requiere fecha de vencimiento al activar la licencia');
                }
                // validar formato de vencimiento
                if ($vencimiento && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $vencimiento)) {
                    return $this->errorResponse($request, 'Formato de fecha inválido. Use YYYY-MM-DD');
                }
                $vDate = $vencimiento ? Carbon::parse($vencimiento) : Carbon::parse($lic->vencimiento);
                if ($vDate->lt(Carbon::today())) {
                    return $this->errorResponse($request, 'La fecha de vencimiento ya está vencida');
                }
                $lic->vencimiento = $vencimiento ?? $lic->vencimiento;
            } else {
                // cuando se desactiva, desactivar todas las características
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
     * actualizar los detalles de la licencia de un usuario.
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

        // actualizar característica específica
        if ($feature && in_array($feature, ['retransmision', 'controlremoto', 'videosfallback'])) {
            if (!$lic->active) {
                return $this->errorResponse($request, 'No se pueden activar características porque la licencia está inactiva', 'feature');
            }

            if ($lic->vencimiento && Carbon::parse($lic->vencimiento)->lt(Carbon::today()) && (bool)$active) {
                return $this->errorResponse($request, 'La licencia está vencida y no se pueden activar características', 'feature');
            }

            $lic->{$feature} = (bool) $active;
        }

        if ($tipo) {
            $lic->tipo = $tipo;
        }

        if ($vencimiento !== null) {
            if ($vencimiento && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $vencimiento)) {
                return $this->errorResponse($request, 'Formato de fecha inválido. Use YYYY-MM-DD');
            }
            $lic->vencimiento = $vencimiento ? $vencimiento : null;
        }

        $lic->active = (bool) $lic->retransmision || (bool) $lic->controlremoto || (bool) $lic->videosfallback || ($lic->tipo !== 'free');

        $lic->save();

        $user->load('licencia');
        if ($request->header('X-Inertia')) {
            return redirect()->route('admin.users');
        }

        return response()->json(['user' => $user]);
    }
}
