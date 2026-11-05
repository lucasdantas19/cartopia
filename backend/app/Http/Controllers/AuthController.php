<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;

class AuthController extends Controller
{
    public function register(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => [
                'required',
                'string',
                'max:72',
                Password::min(8)->mixedCase()->numbers(),
            ],
        ]);

        return $this->authenticatedResponse(User::create($data), 201);
    }

    public function login(Request $request): JsonResponse
    {
        $data = $request->validate(['email' => ['required', 'email'], 'password' => ['required', 'string']]);
        $user = User::where('email', $data['email'])->first();

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            return response()->json(['error' => ['code' => 'INVALID_CREDENTIALS', 'message' => 'E-mail ou senha inválidos.']], 422);
        }

        return $this->authenticatedResponse($user);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->forceFill(['api_token_hash' => null])->save();
        return response()->json(['data' => ['logged_out' => true]]);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json(['data' => $request->user()->only(['id', 'name', 'email'])]);
    }

    private function authenticatedResponse(User $user, int $status = 200): JsonResponse
    {
        $token = Str::random(64);
        $user->forceFill(['api_token_hash' => hash('sha256', $token)])->save();

        return response()->json(['data' => $user->only(['id', 'name', 'email']), 'token' => $token], $status);
    }
}
