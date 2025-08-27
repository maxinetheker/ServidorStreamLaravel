import { PlaceholderPattern } from '@/components/ui/placeholder-pattern';
import { Switch } from '@/components/ui/switch';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, useForm } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Control',
        href: '/control',
    },
];

interface StreamStatus {
    success: boolean;
    isStreaming: boolean;
    exists: boolean;
    message?: string;
}

interface StreamStatusProps {
    isStreaming: boolean;
    exists: boolean;
    hasStreamKey: boolean;
}

interface ControlProps {
    streamStatus: StreamStatusProps;
}

export default function Control({ streamStatus }: ControlProps) {
    const [isStreaming, setIsStreaming] = useState(streamStatus.isStreaming);
    const [isLoading, setIsLoading] = useState(false);

    const { data, setData, post, processing, reset } = useForm({
        action: 'toggle' // 'start' or 'stop'
    });

    // Check stream status on component mount
    useEffect(() => {
        // Always check status when component mounts to ensure fresh data
        if (streamStatus.hasStreamKey) {
            checkStreamStatus();
        } else {
            setIsLoading(false);
        }
    }, []);

    // Also check when streamStatus prop changes (for prefetch scenarios)
    useEffect(() => {
        setIsStreaming(streamStatus.isStreaming);
    }, [streamStatus.isStreaming]);

    const checkStreamStatus = async () => {
        if (!streamStatus.hasStreamKey) {
            setIsLoading(false);
            return;
        }

        try {
            setIsLoading(true);
            const response = await fetch('/api/stream/status');
            const data: StreamStatus = await response.json();
            
            if (data.success) {
                setIsStreaming(data.isStreaming);
            } else {
                console.error('Error checking stream status:', data.message);
                setIsStreaming(false);
            }
        } catch (error) {
            console.error('Error checking stream status:', error);
            setIsStreaming(false);
        } finally {
            setIsLoading(false);
        }
    };

    const handleStreamToggle = (checked: boolean) => {
        if (processing) return;
        
        const endpoint = checked ? '/api/stream/start' : '/api/stream/stop';
        const action = checked ? 'iniciar' : 'detener';
        
        // Optimistically update the UI
        setIsStreaming(checked);
        
        post(endpoint, {
            onSuccess: () => {
                toast.success(`Stream ${checked ? 'iniciado' : 'detenido'} correctamente`);
                reset();
            },
            onError: (errors) => {
                console.error(`Error al ${action} stream:`, errors);
                toast.error(`Error al ${action} el stream`);
                // Revert the switch state on error
                setIsStreaming(!checked);
            }
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Control de Stream" />
            <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4 overflow-x-auto">
                <div className="grid auto-rows-min gap-4 md:grid-cols-3">
                    <div className="aspect-video rounded-xl bg-muted/50 p-6">
                        <div className="space-y-4">
                            <h2 className="text-2xl font-bold">Control de Retransmisión</h2>
                            
                            {!streamStatus.hasStreamKey ? (
                                <div className="text-center py-8">
                                    <p className="text-lg text-gray-600 mb-4">
                                        No tienes una clave de stream configurada
                                    </p>
                                    <a 
                                        href="/configuracion" 
                                        className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                    >
                                        Ir a Configuración
                                    </a>
                                </div>
                            ) : (
                                <>
                                    <div className="flex items-center space-x-4">
                                        <label 
                                            htmlFor="stream-toggle" 
                                            className={`text-lg font-medium ${
                                                isStreaming ? 'text-green-600' : 'text-gray-600'
                                            }`}
                                        >
                                            {isLoading ? 'Cargando...' : (isStreaming ? 'Retransmisión Activa' : 'Retransmisión Inactiva')}
                                        </label>
                                        <Switch
                                            id="stream-toggle"
                                            checked={isStreaming}
                                            onCheckedChange={handleStreamToggle}
                                            disabled={isLoading || processing}
                                            className={`
                                                ${isStreaming ? 'bg-green-500' : 'bg-gray-300'}
                                                ${(isLoading || processing) ? 'opacity-50 cursor-not-allowed' : ''}
                                            `}
                                        />
                                    </div>
                                    {processing && (
                                        <p className="text-sm text-gray-500">
                                            {isStreaming ? 'Deteniendo retransmisión...' : 'Iniciando retransmisión...'}
                                        </p>
                                    )}
                                    <div className="space-y-2">
                                        <p className="text-sm text-gray-600">
                                            Estado: <span className={`font-medium ${isStreaming ? 'text-green-600' : 'text-red-600'}`}>
                                                {isStreaming ? 'Retransmitiendo' : 'Desconectado'}
                                            </span>
                                        </p>
                                        <button
                                            onClick={checkStreamStatus}
                                            disabled={isLoading}
                                            className="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
                                        >
                                            Actualizar estado
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
