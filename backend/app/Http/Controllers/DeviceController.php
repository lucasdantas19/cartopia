<?php

namespace App\Http\Controllers;

use App\Models\UserDevice;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DeviceController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'push_token' => ['required', 'string', 'max:255'],
            'platform' => ['required', 'string', 'in:ios,android'],
            'device_name' => ['nullable', 'string', 'max:120'],
        ]);

        $device = UserDevice::updateOrCreate(
            ['push_token' => $data['push_token']],
            [
                'user_id' => $request->user()->id,
                'platform' => $data['platform'],
                'device_name' => $data['device_name'] ?? null,
                'last_used_at' => now(),
                'revoked_at' => null,
            ],
        );

        return response()->json(['data' => ['id' => $device->id, 'registered' => true]], 201);
    }

    public function destroy(Request $request, UserDevice $device): JsonResponse
    {
        abort_unless($device->user_id === $request->user()->id, 404);
        $device->update(['revoked_at' => now()]);

        return response()->json(['data' => ['revoked' => true]]);
    }
}
