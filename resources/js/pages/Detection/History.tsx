import { Head, Link } from '@inertiajs/react';
import React, { useEffect, useState } from 'react';

interface Detection {
    class: string;
    confidence: number;
}

interface HistoryItem {
    id: number;
    timestamp: string;
    detections: Detection[];
}

const DetectionHistory: React.FC = () => {
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>('');

    useEffect(() => {
        fetchHistory();
    }, []);

    const fetchHistory = async () => {
        try {
            const response = await fetch('/api/detection/history');
            const data = await response.json();
            setHistory(data.history || []);
        } catch (err) {
            setError('Failed to fetch detection history');
            console.error('Error fetching history:', err);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (timestamp: string) => {
        return new Date(timestamp).toLocaleString('id-ID', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });
    };

    const getConfidenceColor = (confidence: number) => {
        if (confidence >= 0.8) return 'text-green-600';
        if (confidence >= 0.6) return 'text-yellow-600';
        return 'text-red-600';
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-100 py-8">
                <div className="mx-auto max-w-4xl px-4">
                    <div className="py-8 text-center">
                        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-blue-500"></div>
                        <p className="mt-4 text-gray-600">Loading detection history...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <>
            <Head title="Detection History" />
            <div className="min-h-screen bg-gray-100 py-8">
                <div className="mx-auto max-w-4xl px-4">
                    <div className="rounded-lg bg-white p-6 shadow-lg">
                        <div className="mb-6 flex items-center justify-between">
                            <h1 className="text-3xl font-bold text-gray-800">Detection History</h1>
                            <Link href="/detection" className="rounded-lg bg-blue-500 px-4 py-2 text-white hover:bg-blue-600">
                                Back to Detection
                            </Link>
                        </div>

                        {error && <div className="mb-4 rounded border border-red-400 bg-red-100 px-4 py-3 text-red-700">{error}</div>}

                        {history.length === 0 ? (
                            <div className="py-8 text-center">
                                <p className="text-lg text-gray-500">No detection history found</p>
                                <p className="mt-2 text-gray-400">Start detecting objects to see history here</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {history.map((item) => (
                                    <div key={item.id} className="rounded-lg border bg-gray-50 p-4">
                                        <div className="mb-3 flex items-start justify-between">
                                            <h3 className="text-lg font-semibold text-gray-800">Detection #{item.id}</h3>
                                            <span className="text-sm text-gray-500">{formatDate(item.timestamp)}</span>
                                        </div>

                                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                                            {item.detections.map((detection, index) => (
                                                <div key={index} className="rounded bg-white p-3 shadow-sm">
                                                    <div className="flex items-center justify-between">
                                                        <span className="font-medium text-gray-700">{detection.class}</span>
                                                        <span className={`text-sm font-semibold ${getConfidenceColor(detection.confidence)}`}>
                                                            {(detection.confidence * 100).toFixed(1)}%
                                                        </span>
                                                    </div>
                                                    <div className="mt-2">
                                                        <div className="h-2 w-full rounded-full bg-gray-200">
                                                            <div
                                                                className="h-2 rounded-full bg-blue-500 transition-all duration-300"
                                                                style={{ width: `${detection.confidence * 100}%` }}
                                                            ></div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="mt-3 border-t border-gray-200 pt-3">
                                            <span className="text-sm text-gray-600">Total objects detected: {item.detections.length}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

export default DetectionHistory;
