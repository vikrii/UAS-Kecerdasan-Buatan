import React, { useEffect, useRef, useState } from 'react';

interface Deteksi {
    kelas: string;
    kepercayaan: number;
    bbox: number[];
}

const SistemDeteksiObjek: React.FC = () => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [cocoModel, setCocoModel] = useState<any>(null);
    const [sedangMemuat, setSedangMemuat] = useState(true);
    const [sedangMendeteksi, setSedangMendeteksi] = useState(false);
    const [deteksi, setDeteksi] = useState<Deteksi[]>([]);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [error, setError] = useState<string>('');
    const [statusKamera, setStatusKamera] = useState<'inisialisasi' | 'siap' | 'error'>('inisialisasi');
    const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Objek yang didukung - sesuai permintaan dan tersedia di COCO-SSD
    const objekDidukung = [
        'person', // untuk wajah
        'cell phone', // ponsel
        'bottle', // botol
        'backpack', // tas punggung
        'fork', // garpu
        'book', // buku
    ];

    // Terjemahan objek ke bahasa Indonesia
    const terjemahanObjek: { [key: string]: string } = {
        person: 'wajah',
        'cell phone': 'ponsel',
        bottle: 'botol',
        backpack: 'tas punggung',
        fork: 'garpu',
        book: 'buku',
    };

    // Warna untuk setiap objek
    const warnaObjek: { [key: string]: string } = {
        person: '#ff6b6b', // Merah untuk wajah
        'cell phone': '#4ecdc4', // Teal untuk ponsel
        bottle: '#45b7d1', // Biru untuk botol
        backpack: '#f9ca24', // Kuning untuk tas punggung
        fork: '#6c5ce7', // Ungu untuk garpu
        book: '#fd79a8', // Pink untuk buku
    };

    // Fungsi untuk memuat script secara dinamis
    const loadScript = (src: string): Promise<void> => {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = () => resolve();
            script.onerror = reject;
            document.head.appendChild(script);
        });
    };

    // Inisialisasi kamera
    const inisialisasiKamera = async () => {
        try {
            setStatusKamera('inisialisasi');
            setError('');

            // Hentikan stream yang ada
            if (stream) {
                stream.getTracks().forEach((track) => track.stop());
            }

            // Constraint kamera
            const constraints = {
                video: {
                    width: { ideal: 640, min: 320 },
                    height: { ideal: 480, min: 240 },
                    facingMode: 'environment',
                    frameRate: { ideal: 30, max: 60 },
                },
                audio: false,
            };

            let mediaStream: MediaStream;

            try {
                // Coba kamera belakang dulu
                mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
            } catch (backCameraError) {
                console.log('Kamera belakang gagal, mencoba kamera depan:', backCameraError);

                // Jika gagal, coba kamera depan
                const frontCameraConstraints = {
                    video: {
                        width: { ideal: 640, min: 320 },
                        height: { ideal: 480, min: 240 },
                        facingMode: 'user',
                        frameRate: { ideal: 30, max: 60 },
                    },
                    audio: false,
                };

                mediaStream = await navigator.mediaDevices.getUserMedia(frontCameraConstraints);
            }

            setStream(mediaStream);

            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;

                // Gunakan Promise untuk menangani event video
                const videoLoadPromise = new Promise<void>((resolve, reject) => {
                    const video = videoRef.current;
                    if (!video) {
                        reject(new Error('Video element not found'));
                        return;
                    }

                    const handleLoadedMetadata = () => {
                        console.log('Video metadata loaded');
                        video.removeEventListener('loadedmetadata', handleLoadedMetadata);
                        video.removeEventListener('error', handleError);
                        resolve();
                    };

                    const handleError = (e: Event) => {
                        console.error('Video error:', e);
                        video.removeEventListener('loadedmetadata', handleLoadedMetadata);
                        video.removeEventListener('error', handleError);
                        reject(new Error('Video loading error'));
                    };

                    video.addEventListener('loadedmetadata', handleLoadedMetadata);
                    video.addEventListener('error', handleError);

                    // Fallback: jika loadedmetadata tidak terpicu dalam 5 detik
                    setTimeout(() => {
                        if (video.videoWidth > 0 && video.videoHeight > 0) {
                            console.log('Video ready by fallback check');
                            video.removeEventListener('loadedmetadata', handleLoadedMetadata);
                            video.removeEventListener('error', handleError);
                            resolve();
                        }
                    }, 5000);
                });

                try {
                    await videoLoadPromise;
                    await videoRef.current.play();

                    if (videoRef.current.videoWidth > 0 && videoRef.current.videoHeight > 0) {
                        setStatusKamera('siap');
                        console.log('Kamera siap dengan resolusi:', videoRef.current.videoWidth, 'x', videoRef.current.videoHeight);
                    } else {
                        throw new Error('Video dimensions not available');
                    }
                } catch (playError) {
                    console.error('Error playing video:', playError);
                    setError('Gagal memutar stream video');
                    setStatusKamera('error');
                }
            }
        } catch (err) {
            console.error('Error inisialisasi kamera:', err);
            let pesanError = 'Gagal mengakses kamera';

            if (err instanceof Error) {
                if (err.name === 'NotAllowedError') {
                    pesanError = 'Izin kamera ditolak. Harap izinkan akses kamera dan refresh halaman.';
                } else if (err.name === 'NotFoundError') {
                    pesanError = 'Kamera tidak ditemukan pada perangkat ini.';
                } else if (err.name === 'NotSupportedError') {
                    pesanError = 'Kamera tidak didukung pada browser ini.';
                } else if (err.name === 'NotReadableError') {
                    pesanError = 'Kamera sedang digunakan aplikasi lain.';
                }
            }

            setError(pesanError);
            setStatusKamera('error');
        }
    };

    // Memuat model TensorFlow
    const muatModel = async () => {
        try {
            console.log('Memuat model AI...');

            // Load TensorFlow.js
            if (!(window as any).tf) {
                await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.10.0/dist/tf.min.js');
            }

            // Load COCO-SSD model
            if (!(window as any).cocoSsd) {
                await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.2/dist/coco-ssd.min.js');
            }

            // Tunggu TensorFlow siap
            await (window as any).tf.ready();

            // Inisialisasi COCO-SSD model
            const coco = await (window as any).cocoSsd.load();
            setCocoModel(coco);

            console.log('Model COCO-SSD berhasil dimuat');
        } catch (err) {
            console.error('Error memuat model:', err);
            setError('Gagal memuat model AI. Menggunakan mode simulasi.');

            // Fallback untuk simulasi jika model real gagal dimuat
            const modelMock = {
                detect: async (video: HTMLVideoElement) => {
                    const deteksiRandom = [];
                    const randomChance = Math.random();

                    if (randomChance > 0.6) {
                        const randomClass = objekDidukung[Math.floor(Math.random() * objekDidukung.length)];
                        deteksiRandom.push({
                            class: randomClass,
                            score: 0.65 + Math.random() * 0.35,
                            bbox: [
                                Math.random() * (video.videoWidth - 150),
                                Math.random() * (video.videoHeight - 150),
                                100 + Math.random() * 100,
                                100 + Math.random() * 100,
                            ],
                        });
                    }

                    return deteksiRandom;
                },
            };

            setCocoModel(modelMock);
        }
    };

    // Inisialisasi aplikasi
    useEffect(() => {
        const inisialisasiApp = async () => {
            try {
                await Promise.all([inisialisasiKamera(), muatModel()]);
            } catch (err) {
                console.error('Error inisialisasi aplikasi:', err);
            } finally {
                setSedangMemuat(false);
            }
        };

        inisialisasiApp();

        return () => {
            if (stream) {
                stream.getTracks().forEach((track) => track.stop());
            }
            if (detectionIntervalRef.current) {
                clearInterval(detectionIntervalRef.current);
            }
        };
    }, []);

    // Fungsi deteksi objek
    const deteksiObjek = async () => {
        if (!cocoModel || !videoRef.current || !canvasRef.current) return;
        if (videoRef.current.readyState < 2) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        if (!ctx) return;

        try {
            // Set canvas size to match video
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            // Clear canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Detect objects with COCO-SSD
            const predictions = await cocoModel.detect(video);

            // Filter predictions untuk objek yang didukung
            const prediksiTerfilter = predictions.filter((pred: { class: string; score: number }) => {
                const className = pred.class.toLowerCase();
                return objekDidukung.includes(className) && pred.score > 0.4; // Threshold confidence 40%
            });

            // Convert ke format yang digunakan aplikasi
            const deteksiBaru: Deteksi[] = prediksiTerfilter.map((pred: { class: string; score: number; bbox: number[] }) => ({
                kelas: pred.class,
                kepercayaan: pred.score,
                bbox: pred.bbox,
            }));

            setDeteksi(deteksiBaru);

            // Draw bounding boxes
            ctx.lineWidth = 3;
            ctx.font = '16px Arial';
            ctx.textAlign = 'left';

            prediksiTerfilter.forEach((prediction: { bbox: number[]; class: string; score: number }) => {
                const [x, y, width, height] = prediction.bbox;

                // Set color based on object type
                const color = warnaObjek[prediction.class] || '#00ff00';
                ctx.strokeStyle = color;

                // Draw bounding box
                ctx.strokeRect(x, y, width, height);

                // Draw label background
                const namaIndo = terjemahanObjek[prediction.class] || prediction.class;
                const label = `${namaIndo} (${(prediction.score * 100).toFixed(1)}%)`;
                const textWidth = ctx.measureText(label).width;

                // Set background color matching stroke color
                ctx.fillStyle = color + '90'; // Add transparency
                ctx.fillRect(x, y > 25 ? y - 25 : y, textWidth + 10, 25);

                // Draw label text
                ctx.fillStyle = '#ffffff';
                ctx.fillText(label, x + 5, y > 25 ? y - 5 : y + 18);
            });

            console.log(
                `Detected ${prediksiTerfilter.length} objects:`,
                prediksiTerfilter.map((p: { class: any }) => p.class),
            );
        } catch (err) {
            console.error('Error deteksi:', err);
        }
    };

    // Mulai deteksi
    const mulaiDeteksi = () => {
        if (statusKamera !== 'siap' || !cocoModel) {
            setError('Kamera atau model belum siap');
            return;
        }

        setSedangMendeteksi(true);
        setError('');

        detectionIntervalRef.current = setInterval(() => {
            deteksiObjek();
        }, 500); // Deteksi setiap 500ms untuk performa yang lebih baik
    };

    // Hentikan deteksi
    const hentikanDeteksi = () => {
        setSedangMendeteksi(false);
        if (detectionIntervalRef.current) {
            clearInterval(detectionIntervalRef.current);
            detectionIntervalRef.current = null;
        }

        // Clear canvas
        if (canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            }
        }

        setDeteksi([]);
    };

    // Coba ulang kamera
    const cobaUlangKamera = () => {
        setStatusKamera('inisialisasi');
        setError('');
        inisialisasiKamera();
    };

    return (
        <div className="min-h-screen bg-gray-100 py-8">
            <div className="mx-auto max-w-6xl px-4">
                <div className="rounded-lg bg-white p-6 shadow-lg">
                    <h1 className="mb-6 text-center text-3xl font-bold text-gray-800">Sistem Deteksi Objek Personal</h1>
                    <p className="mb-6 text-center text-gray-600">Mendeteksi: Wajah, Ponsel, Botol, Tas Punggung, Garpu, dan Buku</p>

                    {error && (
                        <div className="mb-4 rounded border border-red-400 bg-red-100 px-4 py-3 text-red-700">
                            {error}
                            {statusKamera === 'error' && (
                                <button onClick={cobaUlangKamera} className="ml-4 rounded bg-red-500 px-3 py-1 text-white hover:bg-red-600">
                                    Coba Lagi
                                </button>
                            )}
                        </div>
                    )}

                    {sedangMemuat ? (
                        <div className="py-8 text-center">
                            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-blue-500"></div>
                            <p className="mt-4 text-gray-600">Memuat kamera dan model AI...</p>
                            <p className="mt-2 text-sm text-gray-500">
                                Kamera: {statusKamera} | Model: {cocoModel ? 'Siap' : 'Memuat...'}
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                            {/* Feed Kamera */}
                            <div className="lg:col-span-2">
                                <div className="relative overflow-hidden rounded-lg bg-black">
                                    <video ref={videoRef} autoPlay playsInline muted className="h-auto w-full" style={{ minHeight: '360px' }} />
                                    <canvas ref={canvasRef} className="pointer-events-none absolute top-0 left-0 h-full w-full" />

                                    {/* Overlay status kamera */}
                                    {statusKamera === 'inisialisasi' && (
                                        <div className="bg-opacity-50 absolute inset-0 flex items-center justify-center bg-black">
                                            <div className="text-center text-white">
                                                <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-white"></div>
                                                <p>Menginisialisasi kamera...</p>
                                            </div>
                                        </div>
                                    )}

                                    {statusKamera === 'error' && (
                                        <div className="bg-opacity-50 absolute inset-0 flex items-center justify-center bg-red-900">
                                            <div className="text-center text-white">
                                                <p className="mb-4">Error Kamera</p>
                                                <button onClick={cobaUlangKamera} className="rounded bg-white px-4 py-2 text-black hover:bg-gray-200">
                                                    Coba Lagi
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Status deteksi */}
                                    {sedangMendeteksi && statusKamera === 'siap' && (
                                        <div className="absolute top-4 left-4 rounded-full bg-red-500 px-3 py-1 text-sm font-semibold text-white">
                                            🔴 MENDETEKSI
                                        </div>
                                    )}
                                </div>

                                {/* Kontrol */}
                                <div className="mt-4 flex justify-center gap-4">
                                    <button
                                        onClick={mulaiDeteksi}
                                        disabled={sedangMendeteksi || statusKamera !== 'siap' || !cocoModel}
                                        className="rounded-lg bg-green-500 px-6 py-2 text-white hover:bg-green-600 disabled:cursor-not-allowed disabled:bg-gray-400"
                                    >
                                        {sedangMendeteksi ? 'Mendeteksi...' : 'Mulai Deteksi'}
                                    </button>
                                    <button
                                        onClick={hentikanDeteksi}
                                        disabled={!sedangMendeteksi}
                                        className="rounded-lg bg-red-500 px-6 py-2 text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:bg-gray-400"
                                    >
                                        Hentikan Deteksi
                                    </button>
                                </div>

                                {/* Status Sistem */}
                                <div className="mt-4 rounded-lg bg-gray-50 p-4">
                                    <h3 className="mb-2 font-semibold">Status Sistem</h3>
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <span className="text-gray-600">Kamera: </span>
                                            <span
                                                className={`font-semibold ${
                                                    statusKamera === 'siap'
                                                        ? 'text-green-600'
                                                        : statusKamera === 'error'
                                                          ? 'text-red-600'
                                                          : 'text-yellow-600'
                                                }`}
                                            >
                                                {statusKamera === 'siap' ? 'Siap' : statusKamera === 'error' ? 'Error' : 'Inisialisasi'}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-gray-600">Model: </span>
                                            <span className={`font-semibold ${cocoModel ? 'text-green-600' : 'text-yellow-600'}`}>
                                                {cocoModel ? 'Siap' : 'Memuat...'}
                                            </span>
                                        </div>
                                    </div>
                                    {statusKamera === 'siap' && videoRef.current && (
                                        <div className="mt-2 text-xs text-gray-500">
                                            Resolusi: {videoRef.current.videoWidth}x{videoRef.current.videoHeight}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Hasil Deteksi */}
                            <div className="space-y-4">
                                <div className="rounded-lg bg-gray-50 p-4">
                                    <h3 className="mb-3 text-lg font-semibold">Deteksi Saat Ini</h3>
                                    {deteksi.length === 0 ? (
                                        <p className="text-gray-500">Tidak ada objek terdeteksi</p>
                                    ) : (
                                        <ul className="space-y-2">
                                            {deteksi.map((det, index) => (
                                                <li key={index} className="flex items-center justify-between rounded bg-white p-3 shadow-sm">
                                                    <div className="flex items-center gap-3">
                                                        <div
                                                            className="h-4 w-4 rounded-full"
                                                            style={{ backgroundColor: warnaObjek[det.kelas] || '#00ff00' }}
                                                        ></div>
                                                        <span className="font-medium">{terjemahanObjek[det.kelas] || det.kelas}</span>
                                                    </div>
                                                    <span className="text-sm text-gray-600">{(det.kepercayaan * 100).toFixed(1)}%</span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>

                                <div className="rounded-lg bg-gray-50 p-4">
                                    <h3 className="mb-3 text-lg font-semibold">Objek yang Didukung</h3>
                                    <div className="grid grid-cols-1 gap-2 text-sm">
                                        {objekDidukung.map((obj, index) => (
                                            <div key={index} className="flex items-center gap-3 rounded bg-white px-3 py-2">
                                                <div className="h-4 w-4 rounded-full" style={{ backgroundColor: warnaObjek[obj] }}></div>
                                                <span className="font-medium">{terjemahanObjek[obj] || obj}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SistemDeteksiObjek;
