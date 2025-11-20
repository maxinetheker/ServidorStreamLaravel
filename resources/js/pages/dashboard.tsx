import { useEffect, useRef, useState } from 'react';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, usePage, Link } from '@inertiajs/react';
import { Joystick, Play, Upload, Video } from 'lucide-react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    LineElement,
    PointElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    LineController,
    BarController,
} from 'chart.js';

// Registrar los componentes de Chart.js
ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    LineElement,
    PointElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    LineController,
    BarController
);

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Mi Dashboard',
        href: '/dashboard',
    },
];

interface UserStats {
    totalStreams: number;
    totalViewTime: number;
    streamsThisWeek: number;
    avgViewers: number;
    totalVideos: number;
    streamStatus: 'online' | 'offline';
    obsConnected: boolean;
}

export default function UserDashboard() {
    const { auth, userStats, weeklyActivity, videosByType, recentActivity, obsStatus, streamStatus, streamInfo } = usePage().props as any;
    const lineChartRef = useRef<HTMLCanvasElement>(null);
    const barChartRef = useRef<HTMLCanvasElement>(null);
    const lineChartInstance = useRef<ChartJS | null>(null);
    const barChartInstance = useRef<ChartJS | null>(null);

    useEffect(() => {
        if (lineChartRef.current && weeklyActivity) {
            if (lineChartInstance.current) {
                lineChartInstance.current.destroy();
            }

            const ctx = lineChartRef.current.getContext('2d');
            if (ctx) {
                const videosData = (weeklyActivity.videosCount || []) as number[];
                const sizeData = (weeklyActivity.sizeMB || []) as number[];

                lineChartInstance.current = new ChartJS(ctx, {
                    type: 'line',
                    data: {
                        labels: weeklyActivity.labels,
                        datasets: [
                            {
                                label: 'Videos Subidos',
                                data: videosData,
                                borderColor: 'rgba(99, 102, 241, 1)',
                                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                                borderWidth: 3,
                                fill: true,
                                tension: 0.4,
                                pointBackgroundColor: 'rgba(99, 102, 241, 1)',
                                pointBorderColor: '#fff',
                                pointBorderWidth: 2,
                                pointRadius: 6,
                            },
                            {
                                label: 'Tamaño (MB)',
                                data: sizeData,
                                borderColor: 'rgba(34, 197, 94, 1)',
                                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                                borderWidth: 3,
                                fill: false,
                                tension: 0.4,
                                pointBackgroundColor: 'rgba(34, 197, 94, 1)',
                                pointBorderColor: '#fff',
                                pointBorderWidth: 2,
                                pointRadius: 6,
                                yAxisID: 'y1',
                            },
                        ],
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            title: {
                                display: true,
                                text: 'Mi Actividad Semanal - Videos',
                                color: '#374151',
                                font: { size: 16, weight: 'bold' },
                            },
                            legend: {
                                position: 'top',
                                labels: {
                                    color: '#6B7280',
                                    padding: 20,
                                },
                            },
                        },
                        scales: {
                            y: {
                                type: 'linear',
                                display: true,
                                position: 'left',
                                beginAtZero: true,
                                grid: {
                                    color: 'rgba(156, 163, 175, 0.3)',
                                },
                                ticks: {
                                    color: '#6B7280',
                                    stepSize: 1,
                                },
                            },
                            y1: {
                                type: 'linear',
                                display: true,
                                position: 'right',
                                beginAtZero: true,
                                grid: {
                                    drawOnChartArea: false,
                                },
                                ticks: {
                                    color: '#6B7280',
                                },
                            },
                            x: {
                                grid: {
                                    display: false,
                                },
                                ticks: {
                                    color: '#6B7280',
                                },
                            },
                        },
                    },
                });
            }
        }

        // Gráfico de barras - Videos por tipo
        if (barChartRef.current && videosByType) {
            if (barChartInstance.current) {
                barChartInstance.current.destroy();
            }

            const ctx = barChartRef.current.getContext('2d');
            if (ctx) {
                const labels = Object.keys(videosByType);
                const data = Object.values(videosByType) as number[];

                barChartInstance.current = new ChartJS(ctx, {
                    type: 'bar',
                    data: {
                        labels: labels,
                        datasets: [
                            {
                                label: 'Videos por Tipo',
                                data: data,
                                backgroundColor: [
                                    'rgba(99, 102, 241, 0.8)',
                                    'rgba(168, 85, 247, 0.8)',
                                    'rgba(236, 72, 153, 0.8)',
                                    'rgba(34, 197, 94, 0.8)',
                                    'rgba(251, 146, 60, 0.8)',
                                ],
                                borderColor: [
                                    'rgba(99, 102, 241, 1)',
                                    'rgba(168, 85, 247, 1)',
                                    'rgba(236, 72, 153, 1)',
                                    'rgba(34, 197, 94, 1)',
                                    'rgba(251, 146, 60, 1)',
                                ],
                                borderWidth: 2,
                            },
                        ],
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            title: {
                                display: true,
                                text: 'Mis Videos por Tipo de Archivo',
                                color: '#374151',
                                font: { size: 16, weight: 'bold' },
                            },
                            legend: {
                                display: false,
                            },
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                grid: {
                                    color: 'rgba(156, 163, 175, 0.3)',
                                },
                                ticks: {
                                    color: '#6B7280',
                                    stepSize: 1,
                                },
                            },
                            x: {
                                grid: {
                                    display: false,
                                },
                                ticks: {
                                    color: '#6B7280',
                                },
                            },
                        },
                    },
                });
            }
        }

        // Cleanup al desmontar
        return () => {
            if (lineChartInstance.current) {
                lineChartInstance.current.destroy();
            }
            if (barChartInstance.current) {
                barChartInstance.current.destroy();
            }
        };
    }, [weeklyActivity, videosByType]);

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        // Aquí podrías mostrar una notificación de éxito
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Mi Dashboard - StreamFF" />
            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-6 overflow-x-auto">

                {/* Header de Bienvenida */}
                <div className='flex w-full gap-4 flex-wrap md:flex-nowrap'>
                    <div className="w-full bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-slate-800 dark:to-slate-700 rounded-xl p-6 border border-sidebar-border/70">
                        <div className="flex items-center justify-between">
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                                    ¡Hola, {auth?.user?.name || 'Streamer'}! 👋
                                </h1>
                                <p className="text-gray-600 dark:text-gray-300 mt-1">
                                    Aquí tienes un resumen de tu actividad en la plataforma
                                </p>
                            </div>
                            {/*                             <div className="flex items-center space-x-2">
                                <div className={`px-3 py-1 rounded-full text-sm font-medium ${streamStatus.isStreaming
                                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                    : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                                    }`}>
                                    {streamStatus.isStreaming ? '🔴 En Vivo' : '⚫ Desconectado'}
                                </div>
                            </div> */}
                        </div>

                    </div>
                    <div className="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-slate-800 dark:to-slate-700 rounded-xl p-6 border border-sidebar-border/70">
                        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-sidebar-border/70 w-full max-w-sm">
                            <div className="flex items-center justify-center">
                                <div className="p-3 bg-orange-500 rounded-lg">
                                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2h4a1 1 0 011 1v1a1 1 0 01-1 1v9a2 2 0 01-2 2H6a2 2 0 01-2-2V7a1 1 0 01-1-1V5a1 1 0 011-1h4z" />
                                    </svg>
                                </div>
                                <div className="ml-4 text-center">
                                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Mis Videos</p>
                                    <p className="text-3xl font-bold text-gray-900 dark:text-white">{userStats.totalVideos}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                {/* Estadísticas del Usuario */}


                {/* Estado Actual */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-sidebar-border/70">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                            Estado Actual
                        </h3>
                        <div className="space-y-4">
                            {/* Estado del Stream */}
                            <div className={`flex items-center p-3 rounded-lg ${streamStatus.isStreaming
                                ? 'bg-green-50 dark:bg-green-900/20'
                                : 'bg-gray-50 dark:bg-gray-900/20'
                                }`}>
                                <div className={`w-3 h-3 rounded-full mr-3 ${streamStatus.isStreaming ? 'bg-green-500 animate-pulse' : 'bg-gray-500'
                                    }`}></div>
                                <span className={`text-sm font-medium ${streamStatus.isStreaming
                                    ? 'text-green-800 dark:text-green-200'
                                    : 'text-gray-800 dark:text-gray-200'
                                    }`}>
                                    {streamStatus.isStreaming ? '🔴 Retransmisión Activa' : '⚫ Retransmisión Inactiva'}
                                </span>
                            </div>

                            {/* Clientes OBS Conectados */}
                            <div className={`flex items-center p-3 rounded-lg ${obsStatus.clientCount > 0
                                ? 'bg-blue-50 dark:bg-blue-900/20'
                                : 'bg-gray-50 dark:bg-gray-900/20'
                                }`}>
                                <span className={`text-sm font-medium ${obsStatus.clientCount > 0
                                    ? 'text-blue-800 dark:text-blue-200'
                                    : 'text-gray-800 dark:text-gray-200'
                                    }`}>
                                    🎥 {obsStatus.clientCount > 0
                                        ? `${obsStatus.clientCount} Cliente${obsStatus.clientCount > 1 ? 's' : ''} OBS Conectado${obsStatus.clientCount > 1 ? 's' : ''}`
                                        : 'Sin Clientes OBS Conectados'
                                    }
                                </span>
                            </div>

                            {/* Estado de Configuración OBS */}
                            <div className={`flex items-center p-3 rounded-lg ${obsStatus.configured && obsStatus.isActive
                                ? 'bg-purple-50 dark:bg-purple-900/20'
                                : 'bg-orange-50 dark:bg-orange-900/20'
                                }`}>
                                <span className={`text-sm font-medium ${obsStatus.configured && obsStatus.isActive
                                    ? 'text-purple-800 dark:text-purple-200'
                                    : 'text-orange-800 dark:text-orange-200'
                                    }`}>
                                    ⚙️ {obsStatus.configured
                                        ? (obsStatus.isActive ? 'OBS Configurado' : 'OBS Inactivo')
                                        : 'OBS No Configurado'
                                    }
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-xl p-6 border border-sidebar-border/70">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                            Acciones Rápidas
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            <Link
                                href="/control"
                                className="flex items-center p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors"
                            >
                                <div className="p-2 bg-green-600 rounded-lg mr-3">
                                    <Play className="w-5 h-5 text-white" />
                                </div>
                                <div className="text-left">
                                    <p className="font-medium text-gray-900 dark:text-white">Iniciar Retransmisión</p>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">Comenzar transmisión</p>
                                </div>
                            </Link>

                            <Link
                                href="/fallback"
                                className="flex items-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
                            >
                                <div className="p-2 bg-purple-600 rounded-lg mr-3">
                                    <Upload className="w-5 h-5 text-white" />
                                </div>
                                <div className="text-left">
                                    <p className="font-medium text-gray-900 dark:text-white">Subir Video</p>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">Agregar contenido</p>
                                </div>
                            </Link>

                            <Link
                                href="/configuracion"
                                className="flex items-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
                            >
                                <div className="p-2 bg-purple-600 rounded-lg mr-3">
                                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                </div>
                                <div className="text-left">
                                    <p className="font-medium text-gray-900 dark:text-white">Configuración</p>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">Configuración general</p>
                                </div>
                            </Link>

                            <Link
                                href="/streamingtool"
                                className="flex items-center p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors"
                            >
                                <div className="p-2 bg-orange-600 rounded-lg mr-3">
                                    <Video className="w-5 h-5 text-white" />
                                </div>
                                <div className="text-left">
                                    <p className="font-medium text-gray-900 dark:text-white">Control Remoto</p>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">Administra tu transmisión</p>
                                </div>
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Gráficos */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-sidebar-border/70">
                        <div className="h-80">
                            <canvas ref={lineChartRef}></canvas>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-sidebar-border/70">
                        <div className="h-80">
                            <canvas ref={barChartRef}></canvas>
                        </div>
                    </div>
                </div>

                {/* Guía de Inicio */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-700 rounded-xl p-6 border border-sidebar-border/70">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                        🚀 Cómo empezar a hacer streaming
                    </h3>

                    {/* Proceso Principal */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                        <div className="space-y-3">
                            <div className="flex items-center">
                                <span className="w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center text-sm font-bold mr-3">1</span>
                                <p className="font-semibold text-gray-900 dark:text-white">Generar Stream Key</p>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400 ml-11">
                                Ve a configuración y genera tu clave de stream única para autenticarte
                            </p>
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center">
                                <span className="w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center text-sm font-bold mr-3">2</span>
                                <p className="font-semibold text-gray-900 dark:text-white">Subir Videos Fallback</p>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400 ml-11">
                                Sube videos de respaldo que se mostrarán cuando no estés en vivo
                            </p>
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center">
                                <span className="w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center text-sm font-bold mr-3">3</span>
                                <p className="font-semibold text-gray-900 dark:text-white">Configurar OBS</p>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400 ml-11">
                                Configura OBS Studio con tu Stream Key y servidor RTMP
                            </p>
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center">
                                <span className="w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center text-sm font-bold mr-3">4</span>
                                <p className="font-semibold text-gray-900 dark:text-white">¡Empezar Stream!</p>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400 ml-11">
                                Inicia tu transmisión en vivo desde el panel de control
                            </p>
                        </div>
                    </div>

                    {/* Configuración de OBS */}
                    <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                        <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-4">
                            📺 Configuración de OBS Studio
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-3">
                                <h5 className="font-medium text-gray-900 dark:text-white">Configuración Básica:</h5>
                                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 ml-4">
                                    <li>• Descarga e instala OBS Studio</li>
                                    <li>• Ve a un canal o añade uno nuevo</li>
                                    <li>• Selecciona "Navegador" y establece las dimensiones 1920x1080</li>
                                    <li>• Url: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">https://streamff.repo.net.pe/live?key=TU_STREAM_KEY</code></li>
                                    <li>• El URL y la clave para transmitir desde tu dispositivo u otro se encuentran en la configuración de tu cuenta.</li>
                                </ul>
                            </div>
                            <div className="space-y-3">
                                <h5 className="font-medium text-gray-900 dark:text-white">WebSocket (Opcional):</h5>
                                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 ml-4">
                                    <li>• Ve a Herramientas → WebSocket Server Settings</li>
                                    <li>• Habilita el servidor WebSocket</li>
                                    <li>• Puerto: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">4455</code></li>
                                    <li>• Configura una contraseña</li>
                                    <li>• Esto permitirá control remoto desde la plataforma</li>
                                    <li>• La contraseña y puerto deben coincidir con la configurada en la plataforma</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
