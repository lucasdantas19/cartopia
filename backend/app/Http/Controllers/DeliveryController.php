<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreDeliveryRequest;
use App\Http\Resources\DeliveryMessageResource;
use App\Http\Resources\DeliveryResource;
use App\Services\AuthorizeDelivery;
use App\Services\CreateDelivery;
use App\Services\OpenDeliveryMessage;
use App\Services\ResolveDeliveryChallenge;
use App\Services\ResetDeliveryChallenge;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;

class DeliveryController extends Controller
{
    public function store(StoreDeliveryRequest $request, CreateDelivery $createDelivery): JsonResponse
    {
        [
            'delivery' => $delivery,
            'recipient_access_token' => $recipientAccessToken,
            'sender_access_token' => $senderAccessToken,
        ] = $createDelivery->handle($request->validated(), $request->user()?->id);

        $recipientPath = '/d/'.$delivery->public_id.'#token='.$recipientAccessToken;
        $senderPath = '/d/'.$delivery->public_id.'#token='.$senderAccessToken.'&role=sender';

        return response()->json([
            'data' => DeliveryResource::make($delivery),
            'access_token' => $recipientAccessToken,
            'recipient_access_token' => $recipientAccessToken,
            'sender_access_token' => $senderAccessToken,
            'tracking_path' => $recipientPath,
            'recipient_tracking_path' => $recipientPath,
            'sender_tracking_path' => $senderPath,
        ], 201);
    }

    public function show(Request $request, string $publicId, AuthorizeDelivery $authorizeDelivery): DeliveryResource
    {
        ['delivery' => $delivery, 'role' => $role] = $authorizeDelivery->handle($request, $publicId);
        $delivery->setAttribute('access_role', $role);

        return DeliveryResource::make($delivery);
    }

    public function recipientShareLink(Request $request, string $publicId, AuthorizeDelivery $authorizeDelivery): JsonResponse
    {
        $delivery = $authorizeDelivery->handle($request, $publicId, 'sender')['delivery'];

        if ($delivery->recipient_access_token_encrypted === null) {
            return response()->json([
                'error' => [
                    'code' => 'SHARE_LINK_UNAVAILABLE',
                    'message' => 'The recipient link is unavailable for this delivery.',
                ],
            ], 409);
        }

        return response()->json([
            'data' => [
                'public_id' => $delivery->public_id,
                'recipient_access_token' => Crypt::decryptString($delivery->recipient_access_token_encrypted),
            ],
        ])->header('Cache-Control', 'no-store');
    }

    public function message(Request $request, string $publicId, AuthorizeDelivery $authorizeDelivery, OpenDeliveryMessage $openDeliveryMessage): DeliveryMessageResource|JsonResponse
    {
        $delivery = $authorizeDelivery->handle($request, $publicId, 'recipient')['delivery'];

        if (! $delivery->hasArrived()) {
            return response()->json([
                'error' => [
                    'code' => 'DELIVERY_NOT_ARRIVED',
                    'message' => 'The delivery has not arrived yet.',
                ],
            ], 403);
        }

        if ($delivery->unlock_type !== 'none' && $delivery->unlocked_at === null) {
            return response()->json([
                'error' => [
                    'code' => 'DELIVERY_CHALLENGE_REQUIRED',
                    'message' => 'Resolva o desafio para abrir a carta.',
                ],
            ], 403);
        }

        $delivery = $openDeliveryMessage->handle($delivery);

        return DeliveryMessageResource::make($delivery);
    }

    public function challenge(Request $request, string $publicId, AuthorizeDelivery $authorizeDelivery, ResolveDeliveryChallenge $resolveDeliveryChallenge): JsonResponse
    {
        $delivery = $authorizeDelivery->handle($request, $publicId, 'recipient')['delivery'];
        $remaining = max(0, (int) config('deliveries.max_unlock_attempts') - (int) $delivery->unlock_attempts);
        $state = $delivery->unlock_type === 'hangman' ? $resolveDeliveryChallenge->state($delivery) : [];

        return response()->json([
            'data' => [
                'type' => $delivery->unlock_type,
                'solved' => $delivery->unlock_type === 'none' || $delivery->unlocked_at !== null,
                'attempts_remaining' => $remaining,
                ...$state,
            ],
        ]);
    }

    public function attemptChallenge(Request $request, string $publicId, AuthorizeDelivery $authorizeDelivery, ResolveDeliveryChallenge $resolveDeliveryChallenge): JsonResponse
    {
        $delivery = $authorizeDelivery->handle($request, $publicId, 'recipient')['delivery'];
        $request->validate(['answer' => ['required', 'string', 'max:'.($delivery->unlock_type === 'hangman' ? 1 : 120)]]);

        if (! $delivery->hasArrived()) {
            return response()->json(['error' => ['code' => 'DELIVERY_NOT_ARRIVED', 'message' => 'A entrega ainda não chegou.']], 403);
        }

        $result = $resolveDeliveryChallenge->handle($delivery, $request->string('answer')->toString());
        if (! $result['solved']) {
            if ($delivery->unlock_type === 'hangman' && $result['attempts_remaining'] > 0) {
                return response()->json(['data' => [
                    'solved' => false,
                    'attempts_remaining' => $result['attempts_remaining'],
                    ...$resolveDeliveryChallenge->state($delivery),
                ]]);
            }
            return response()->json([
                'error' => [
                    'code' => $result['attempts_remaining'] === 0 ? 'DELIVERY_CHALLENGE_LOCKED' : 'DELIVERY_CHALLENGE_INCORRECT',
                    'message' => $result['attempts_remaining'] === 0 ? 'O limite de tentativas foi atingido.' : 'Resposta incorreta.',
                ],
                'data' => ['attempts_remaining' => $result['attempts_remaining']],
            ], 422);
        }

        return response()->json(['data' => ['solved' => true, 'attempts_remaining' => $result['attempts_remaining'], ...($delivery->unlock_type === 'hangman' ? $resolveDeliveryChallenge->state($delivery) : [])]]);
    }

    public function resetChallenge(Request $request, string $publicId, AuthorizeDelivery $authorizeDelivery, ResetDeliveryChallenge $resetDeliveryChallenge): JsonResponse
    {
        $delivery = $authorizeDelivery->handle($request, $publicId, 'sender')['delivery'];
        if (! $resetDeliveryChallenge->handle($delivery)) {
            return response()->json([
                'error' => ['code' => 'DELIVERY_CHALLENGE_NOT_LOCKED', 'message' => 'O desafio ainda não está bloqueado para uma nova tentativa.'],
            ], 409);
        }

        return response()->json(['data' => ['reset' => true, 'attempts_remaining' => (int) config('deliveries.max_unlock_attempts')]]);
    }
}
