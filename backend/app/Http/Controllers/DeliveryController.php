<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreDeliveryRequest;
use App\Http\Resources\DeliveryMessageResource;
use App\Http\Resources\DeliveryResource;
use App\Services\AuthorizeDelivery;
use App\Services\CreateDelivery;
use App\Services\OpenDeliveryMessage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DeliveryController extends Controller
{
    public function store(StoreDeliveryRequest $request, CreateDelivery $createDelivery): JsonResponse
    {
        [
            'delivery' => $delivery,
            'recipient_access_token' => $recipientAccessToken,
            'sender_access_token' => $senderAccessToken,
        ] = $createDelivery->handle($request->validated());

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

        $delivery = $openDeliveryMessage->handle($delivery);

        return DeliveryMessageResource::make($delivery);
    }
}
