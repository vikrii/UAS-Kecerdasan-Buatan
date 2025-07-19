<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DetectionController extends Controller
{
    /**
     * Display the main detection page
     */
    public function index(): Response
    {
        return Inertia::render('Detection/Index', [
            'title' => 'Object Detection System',
            'supportedObjects' => [
                'person',
                'cell phone',
                'bottle',
                'backpack',
                'fork',
                'book'
            ]
        ]);
    }

    /**
     * Save detection results
     */
    public function store(Request $request)
    {
        $request->validate([
            'detections' => 'required|array',
            'detections.*.class' => 'required|string',
            'detections.*.confidence' => 'required|numeric|min:0|max:1',
            'detections.*.bbox' => 'required|array',
            'timestamp' => 'required|date'
        ]);

        // Here you can save detection results to database
        // For now, we'll just return success response

        return response()->json([
            'success' => true,
            'message' => 'Detection results saved successfully',
            'data' => [
                'detections_count' => count($request->detections),
                'timestamp' => $request->timestamp
            ]
        ]);
    }

    /**
     * Get detection history
     */
    public function history()
    {
        // Return mock history data
        // In real implementation, fetch from database
        return response()->json([
            'history' => [
                [
                    'id' => 1,
                    'timestamp' => now()->subMinutes(5),
                    'detections' => [
                        ['class' => 'person', 'confidence' => 0.95],
                        ['class' => 'cell phone', 'confidence' => 0.87]
                    ]
                ],
                [
                    'id' => 2,
                    'timestamp' => now()->subMinutes(10),
                    'detections' => [
                        ['class' => 'laptop', 'confidence' => 0.92],
                        ['class' => 'book', 'confidence' => 0.78]
                    ]
                ]
            ]
        ]);
    }
}
