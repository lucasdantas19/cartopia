<?php

use App\Http\Controllers\DeliveryController;
use Illuminate\Support\Facades\Route;

Route::get('/health', function () {
    return response()->json(['status' => 'ok']);
});

Route::post('/deliveries', [DeliveryController::class, 'store']);
Route::get('/deliveries/{publicId}', [DeliveryController::class, 'show']);
Route::get('/deliveries/{publicId}/message', [DeliveryController::class, 'message']);
