<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreDeliveryRequest;
use App\Http\Resources\DeliveryMessageResource;
use App\Http\Resources\DeliveryResource;
use App\Models\Delivery;
use App\Services\CreateDelivery;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DeliveryController extends Controller
{
    public function store(StoreDeliveryRequest $request, CreateDelivery $createDelivery): JsonResponse
    {
        ['delivery' => $delivery, 'access_token' => $accessToken] = $createDelivery->handle($request->validated());

        return response()->json([
            'data' => DeliveryResource::make($delivery),
            'access_token' => $accessToken,
            'tracking_path' => '/deliveries/'.$delivery->public_id.'#token='.$accessToken,
        ], 201);
    }

    public function show(Request $request, string $publicId): DeliveryResource
    {
        return DeliveryResource::make($this->authorizedDelivery($request, $publicId));
    }

    public function message(Request $request, string $publicId): DeliveryMessageResource|JsonResponse
    {
        $delivery = $this->authorizedDelivery($request, $publicId);

        if (! $delivery->hasArrived()) {
            return response()->json([
                'error' => [
                    'code' => 'DELIVERY_NOT_ARRIVED',
                    'message' => 'The delivery has not arrived yet.',
                ],
            ], 403);
        }

        return DeliveryMessageResource::make($delivery);
    }

    private function authorizedDelivery(Request $request, string $publicId): Delivery
    {
        $delivery = Delivery::where('public_id', $publicId)->first();
        $token = $request->bearerToken();

        if ($delivery === null || $token === null || ! hash_equals($delivery->access_token_hash, hash('sha256', $token))) {
            abort(404);
        }

        return $delivery;
    }
}
