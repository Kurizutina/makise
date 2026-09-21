<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = min(max((int) $request->query('per_page', 20), 1), 50);
        return response()->json(
            $request->user()->notifications()->orderByDesc('NotificationDate')->paginate($perPage)
        );
    }

    public function markAllRead(Request $request): JsonResponse
    {
        $request->user()->notifications()->where('NotificationSeen', false)->update(['NotificationSeen' => true]);
        return response()->json(['status' => 'ok']);
    }
}
