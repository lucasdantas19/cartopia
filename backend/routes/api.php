<?php

use App\Http\Controllers\DeliveryController;
use App\Http\Controllers\AdminDeliveryController;
use Illuminate\Support\Facades\Route;

Route::get('/health', function () {
    return response()->json(['status' => 'ok']);
});

Route::post('/deliveries', [DeliveryController::class, 'store'])
    ->middleware('throttle:delivery-creation');
Route::get('/deliveries/{publicId}', [DeliveryController::class, 'show'])
    ->middleware('throttle:delivery-tracking');
Route::get('/deliveries/{publicId}/message', [DeliveryController::class, 'message'])
    ->middleware('throttle:message-opening');

Route::middleware('admin.access')->prefix('admin')->group(function (): void {
    Route::get('/deliveries', [AdminDeliveryController::class, 'index']);
    Route::post('/deliveries/{publicId}/regenerate-links', [AdminDeliveryController::class, 'regenerateLinks']);
    Route::delete('/deliveries/{publicId}', [AdminDeliveryController::class, 'destroy']);
});
