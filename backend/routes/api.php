<?php

use App\Http\Controllers\DeliveryController;
use App\Http\Controllers\AdminDeliveryController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\AccountController;
use Illuminate\Support\Facades\Route;

Route::get('/health', function () {
    return response()->json(['status' => 'ok']);
});

Route::post('/auth/register', [AuthController::class, 'register']);
Route::post('/auth/login', [AuthController::class, 'login']);

Route::middleware('user.auth')->group(function (): void {
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::get('/account/deliveries', [AccountController::class, 'deliveries']);
    Route::get('/account/incoming-deliveries', [AccountController::class, 'incomingDeliveries']);
    Route::get('/account/incoming-deliveries/{publicId}/token', [AccountController::class, 'incomingDeliveryToken']);
    Route::get('/account/locations', [AccountController::class, 'locations']);
    Route::post('/account/locations', [AccountController::class, 'storeLocation']);
    Route::delete('/account/locations/{location}', [AccountController::class, 'deleteLocation']);
    Route::get('/account/recipients', [AccountController::class, 'recipients']);
    Route::post('/account/recipients', [AccountController::class, 'storeRecipient']);
    Route::delete('/account/recipients/{recipient}', [AccountController::class, 'deleteRecipient']);
    Route::get('/account/tracked-deliveries', [AccountController::class, 'trackedDeliveries']);
    Route::post('/account/tracked-deliveries', [AccountController::class, 'storeTrackedDelivery']);
    Route::get('/account/tracked-deliveries/{trackedDelivery}/token', [AccountController::class, 'trackedDeliveryToken']);
    Route::delete('/account/tracked-deliveries/{trackedDelivery}', [AccountController::class, 'deleteTrackedDelivery']);
});

Route::post('/deliveries', [DeliveryController::class, 'store'])
    ->middleware(['throttle:delivery-creation', 'user.optional']);
Route::get('/deliveries/{publicId}', [DeliveryController::class, 'show'])
    ->middleware('throttle:delivery-tracking');
Route::get('/deliveries/{publicId}/recipient-share-link', [DeliveryController::class, 'recipientShareLink'])
    ->middleware('throttle:delivery-tracking');
Route::get('/deliveries/{publicId}/message', [DeliveryController::class, 'message'])
    ->middleware('throttle:message-opening');

Route::middleware('admin.access')->prefix('admin')->group(function (): void {
    Route::get('/deliveries', [AdminDeliveryController::class, 'index']);
    Route::post('/deliveries/{publicId}/regenerate-links', [AdminDeliveryController::class, 'regenerateLinks']);
    Route::delete('/deliveries/{publicId}', [AdminDeliveryController::class, 'destroy']);
});

Route::prefix('v1')->group(function (): void {
    require __DIR__.'/api_v1.php';
});
