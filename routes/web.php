<?php

use App\Http\Controllers\DetectionController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return redirect('/detection');
});

Route::prefix('detection')->group(function () {
    Route::get('/', [DetectionController::class, 'index'])->name('detection.index');
    Route::post('/', [DetectionController::class, 'store'])->name('detection.store');
    Route::get('/history', [DetectionController::class, 'history'])->name('detection.history');
});

// API routes for real-time detection
Route::prefix('api/detection')->group(function () {
    Route::post('/save', [DetectionController::class, 'store']);
    Route::get('/history', [DetectionController::class, 'history']);
});
