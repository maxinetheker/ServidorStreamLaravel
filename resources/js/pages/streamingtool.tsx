import { PlaceholderPattern } from '@/components/ui/placeholder-pattern';
import { Switch } from '@/components/ui/switch';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, useForm, usePage, router } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Monitor, Play, Square, RefreshCw, Wifi, WifiOff, Eye, Video, Settings, AlertCircle, Key, Copy } from 'lucide-react';
import { toast } from 'sonner';

// Breadcrumbs para la navegación
const breadcrumbs: BreadcrumbItem[] = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Streaming Tool', href: '/streaming-tool' }
];

// Interface para cliente OBS individual
interface ObsClient {
    id: string;
    streamKey?: string;
    status: 'connected' | 'disconnected' | 'error';
    address?: string;
    connectionStatus?: string;
    connection_status?: string;
    isStreaming: boolean;
    isRecording: boolean;
    currentScene?: {
        currentProgramSceneName: string;
        currentProgramSceneUuid: string;
        sceneName: string;
        sceneUuid: string;
    };
    currentSceneName?: string;
    scenes: Array<{
        sceneName: string;
        sceneIndex?: number;
        sceneUuid?: string;
    }>;
    stream?: {
        outputActive: boolean;
        outputBytes: number;
        outputCongestion: number;
        outputDuration: number;
        outputReconnecting: boolean;
    };
    record?: {
        outputActive: boolean;
        outputBytes: number;
        outputDuration: number;
        outputPaused: boolean;
        outputTimecode: string;
    };
    lastSeen?: string;
    timestamp?: string;
    userAgent?: string;
    outputs?: Array<{
        outputName: string;
        outputType: string;
        outputActive: boolean;
    }>;
    stats?: {
        fps?: number;
        renderTotalFrames?: number;
        renderSkippedFrames?: number;
        outputTotalFrames?: number;
        outputSkippedFrames?: number;
        averageFrameTime?: number;
        cpuUsage?: number;
        memoryUsage?: number;
        freeDiskSpace?: number;
    };
    version?: {
        obsVersion?: string;
        obsWebSocketVersion?: string;
        rpcVersion?: number;
        availableRequests?: string[];
        supportedImageFormats?: string[];
        platform?: string;
        platformDescription?: string;
    };
    lastUpdate?: string;
}

interface StreamingToolProps {
    hasStreamKey: boolean;
    streamKey?: string;
    hasObsConfig: boolean;
    obsConfig?: {
        host: string;
        port: number;
        is_active: boolean;
    };
    obsStatusData?: {
        clients: ObsClient[];
        message: string;
    };
    [key: string]: any; // Para satisfacer PageProps
}

export default function StreamingTool() {
    const { props } = usePage<StreamingToolProps>();
    const { hasStreamKey, streamKey, hasObsConfig, obsConfig, obsStatusData } = props;

    const [obsClients, setObsClients] = useState<ObsClient[]>(() => {
        // Inicializar con datos del backend si están disponibles
        if (obsStatusData?.clients) {
            console.log("Initial OBS clients from props:", obsStatusData.clients);
            return obsStatusData.clients;
        }
        return [];
    });
    const [isLoadingStatus, setIsLoadingStatus] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [selectedClient, setSelectedClient] = useState<string>('');
    const [selectedScene, setSelectedScene] = useState<string>(() => {
        if (
            obsStatusData &&
            Array.isArray(obsStatusData.clients) &&
            obsStatusData.clients.length > 0
        ) {
            const currentScene = obsStatusData.clients[0].currentScene;
            if (typeof currentScene === 'string') {
                return currentScene;
            }
            return currentScene?.currentProgramSceneName || 'N/A';
        }
        return '';
    });

    // useForm para operaciones que requieren POST/PUT/DELETE
    const { data, setData, post, processing, reset } = useForm({
        sceneName: '',
        clientId: ''
    });

    // Función para obtener el estado de los clientes OBS usando router.reload()
    const refreshObsData = (showToast = true) => {
        if (!hasStreamKey) {
            if (showToast) toast.error('Necesitas generar un stream key primero');
            return;
        }

        setIsLoadingStatus(true);
        
        // Recargar la página para obtener datos frescos del backend
        router.reload({
            only: ['clients'],
            onFinish: () => {
                setIsLoadingStatus(false);
                if (showToast) toast.success('Estado OBS actualizado');
            },
            onError: () => {
                setIsLoadingStatus(false);
                if (showToast) toast.error('Error al actualizar estado OBS');
            }
        });
    };

    // Detectar el estado inicial y cargar datos OBS automáticamente
    useEffect(() => {
        if (hasStreamKey && hasObsConfig) {
            // Pequeño delay para que se monte completamente el componente
            setTimeout(() => {
                refreshObsData();
            }, 1000);
        }
    }, [hasStreamKey, hasObsConfig]);

    // Función para conectar OBS usando useForm
    const connectObs = () => {
        if (!hasObsConfig) {
            toast.error('Necesitas configurar OBS WebSocket primero');
            return;
        }

        setIsConnecting(true);
        post('/api/obs/connect', {
            preserveScroll: true,
            onFinish: () => {
                setIsConnecting(false);
                // Actualizar estado después de conectar
                setTimeout(() => refreshObsData(), 2000);
            }
        });
    };

   
    // Función para iniciar stream usando useForm
    const startObsStream = () => {
        post('/streaming-tool/start-obs-stream', {
            preserveScroll: true,
            onSuccess: () => {
                
                // Múltiples actualizaciones para asegurar que se vea el cambio
                setTimeout(() => router.reload({ only: ['obsStatusData'] }), 1000);
                setTimeout(() => router.reload({ only: ['obsStatusData'] }), 3000);
                setTimeout(() => router.reload({ only: ['obsStatusData'] }), 5000);
                setTimeout(() => router.reload({ only: ['obsStatusData'] }), 7000);
                toast.success('Stream iniciado exitosamente');
            },
            onError: (errors) => {
                console.error('Error al iniciar stream:', errors);
                toast.error('Error al iniciar stream');
            }
        });
    };

    // Función para detener stream usando useForm
    const stopObsStream = () => {
        post('/streaming-tool/stop-obs-stream', {
            preserveScroll: true,
            onSuccess: () => {
                toast.success('Stream detenido exitosamente');
                // Múltiples actualizaciones para asegurar que se vea el cambio
                setTimeout(() => router.reload({ only: ['clients'] }), 1000);
                setTimeout(() => router.reload({ only: ['clients'] }), 3000);
                setTimeout(() => router.reload({ only: ['clients'] }), 5000);
            },
            onError: (errors) => {
                console.error('Error al detener stream:', errors);
                toast.error('Error al detener stream');
            }
        });
    };

    // Función para cambiar escena usando router.post directamente
    const changeObsScene = (clientId: string, sceneName: string) => {
        if (!clientId || !sceneName) {
            toast.error('Selecciona un cliente y una escena');
            return;
        }

        console.log('Enviando cambio de escena:', { clientId, sceneName });

        // Usar router.post directamente con los datos
        router.post('/streaming-tool/change-obs-scene', {
            clientId: clientId,
            sceneName: sceneName
        }, {
            preserveScroll: true,
            onSuccess: () => {
                toast.success('Escena cambiada exitosamente');
                // Actualizar estado inmediatamente después de cambiar escena
                router.reload({ only: ['clients'] });
            },
            onError: (errors) => {
                console.error('Error al cambiar escena:', errors);
                toast.error('Error al cambiar escena');
            }
        });
    };

    // Auto-refresh cada 30 segundos
    // Actualización automática cada 5 segundos para mantener los datos frescos (sin toast)
    useEffect(() => {
        if (hasStreamKey && hasObsConfig) {
            const interval = setInterval(() => {
                // Usar router.reload silenciosamente para actualizar solo los datos de clients
                router.reload({ 
                    only: ['clients']
                });
            }, 5000); // Cada 5 segundos

            return () => clearInterval(interval);
        }
    }, [hasStreamKey, hasObsConfig]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Streaming Tool" />
            <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4 overflow-x-auto">
                <div className="grid auto-rows-min gap-4 md:grid-cols-1 max-w-6xl">
                    
                    {/* Estado del Sistema */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Monitor className="h-5 w-5" />
                                Estado del Sistema
                            </CardTitle>
                            <CardDescription>
                                Estado actual de la configuración y conexiones OBS
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {/* Stream Key Status */}
                                <div className="flex items-center justify-between p-3 border rounded-lg">
                                    <div className="flex items-center gap-2">
                                        <Key className="h-4 w-4" />
                                        <span className="text-sm font-medium">Stream Key</span>
                                    </div>
                                    <Badge variant={hasStreamKey ? "default" : "destructive"}>
                                        {hasStreamKey ? 'Configurado' : 'No configurado'}
                                    </Badge>
                                </div>

                                {/* OBS Config Status */}
                                <div className="flex items-center justify-between p-3 border rounded-lg">
                                    <div className="flex items-center gap-2">
                                        <Settings className="h-4 w-4" />
                                        <span className="text-sm font-medium">OBS WebSocket</span>
                                    </div>
                                    <Badge variant={hasObsConfig ? "default" : "destructive"}>
                                        {hasObsConfig ? 'Configurado' : 'No configurado'}
                                    </Badge>
                                </div>

                                {/* OBS Clients Status */}
                                <div className="flex items-center justify-between p-3 border rounded-lg">
                                    <div className="flex items-center gap-2">
                                        <Video className="h-4 w-4" />
                                        <span className="text-sm font-medium">Clientes OBS</span>
                                    </div>
                                    <Badge variant={(obsStatusData?.clients?.length || 0) > 0 ? "default" : "secondary"}>
                                        {obsStatusData?.clients?.length || 0} conectados
                                    </Badge>
                                </div>
                            </div>

                            {/* Mostrar configuración actual */}
                            {hasObsConfig && obsConfig && (
                                <div className="mt-4 p-3 bg-muted rounded-lg">
                                    <h4 className="text-sm font-medium mb-2">Configuración OBS WebSocket:</h4>
                                    <div className="text-sm text-muted-foreground">
                                        <div>Host: {obsConfig.host}</div>
                                        <div>Puerto: {obsConfig.port}</div>
                                        <div>Estado: {obsConfig.is_active ? 'Activo' : 'Inactivo'}</div>
                                    </div>
                                </div>
                            )}

                            {/* Mostrar Stream Key si existe */}
                            {hasStreamKey && streamKey && (
                                <div className="mt-4 p-3 bg-muted rounded-lg">
                                    <h4 className="text-sm font-medium mb-2">Stream Key Actual:</h4>
                                    <div className="flex items-center gap-2">
                                        <code className="text-xs bg-background px-2 py-1 rounded">
                                            {streamKey.substring(0, 20)}...
                                        </code>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => {
                                                navigator.clipboard.writeText(streamKey);
                                                toast.success('Stream key copiado al portapapeles');
                                            }}
                                        >
                                            <Copy className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* Acciones rápidas */}
                            <div className="flex gap-2 pt-4">
                                {!hasStreamKey && (
                                    <Button asChild variant="outline">
                                        <a href="/configuracion">
                                            <Key className="mr-2 h-4 w-4" />
                                            Generar Stream Key
                                        </a>
                                    </Button>
                                )}
                                
                                {!hasObsConfig && (
                                    <Button asChild variant="outline">
                                        <a href="/configuracion">
                                            <Settings className="mr-2 h-4 w-4" />
                                            Configurar OBS
                                        </a>
                                    </Button>
                                )}

                                {hasStreamKey && hasObsConfig && (
                                    <>
                                        <Button
                                            onClick={connectObs}
                                            disabled={isConnecting}
                                            variant="outline"
                                        >
                                            {isConnecting ? (
                                                <>
                                                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                                    Conectando...
                                                </>
                                            ) : (
                                                <>
                                                    <Wifi className="mr-2 h-4 w-4" />
                                                    Reconectar Todo
                                                </>
                                            )}
                                        </Button>

                                        <Button
                                            onClick={() => refreshObsData(true)}
                                            disabled={isLoadingStatus}
                                            variant="outline"
                                        >
                                            {isLoadingStatus ? (
                                                <>
                                                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                                    Actualizando...
                                                </>
                                            ) : (
                                                <>
                                                    <RefreshCw className="mr-2 h-4 w-4" />
                                                    Actualizar Estado
                                                </>
                                            )}
                                        </Button>
                                    </>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Panel de Control OBS */}
                    {hasStreamKey && hasObsConfig && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Video className="h-5 w-5" />
                                    Control OBS Studio
                                </CardTitle>
                                <CardDescription>
                                    Gestiona tus instancias de OBS conectadas
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {(!obsStatusData?.clients || obsStatusData.clients.length === 0) ? (
                                    <Alert>
                                        <AlertCircle className="h-4 w-4" />
                                        <AlertDescription>
                                            No hay clientes OBS conectados. Asegúrate de que OBS Studio esté ejecutándose y configurado correctamente.
                                        </AlertDescription>
                                    </Alert>
                                ) : (
                                    <div className="space-y-6">
                                        {(obsStatusData?.clients || []).map((client, index) => (
                                            <Card key={client.id} className="border-l-4 border-l-primary">
                                                <CardHeader className="pb-3">
                                                    <div className="flex items-center justify-between">
                                                        <CardTitle className="text-base flex items-center gap-2">
                                                            <Monitor className="h-4 w-4" />
                                                            Cliente OBS #{index + 1}
                                                        </CardTitle>
                                                        <div className="flex items-center gap-2">
                                                            <Badge variant={client.status === 'connected' ? 'default' : 'destructive'}>
                                                                {client.status === 'connected' ? (
                                                                    <>
                                                                        <Wifi className="mr-1 h-3 w-3" />
                                                                        Conectado
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <WifiOff className="mr-1 h-3 w-3" />
                                                                        Desconectado
                                                                    </>
                                                                )}
                                                            </Badge>
                                                            
                                                            {client.isStreaming && (
                                                                <Badge variant="destructive">
                                                                    <Eye className="mr-1 h-3 w-3" />
                                                                    En Vivo
                                                                </Badge>
                                                            )}
                                                            
                                                            {client.isRecording && (
                                                                <Badge variant="secondary">
                                                                    Grabando
                                                                </Badge>
                                                            )}
                                                            
                                                            {/* Badge adicional para estado de output si es diferente */}
                                                            {!client.isStreaming && client.stream?.outputActive && (
                                                                <Badge variant="outline" className="text-yellow-600">
                                                                    Output Activo (No Streaming)
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </div>
                                                    
                                                    {client.streamKey && (
                                                        <CardDescription>
                                                            Stream Key: {client.streamKey.substring(0, 16)}...
                                                        </CardDescription>
                                                    )}
                                                </CardHeader>
                                                
                                                <CardContent className="space-y-4">
                                                    {/* Información del cliente */}
                                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                                        <div>
                                                            <div className="font-medium">Dirección</div>
                                                            <div className="text-muted-foreground">{client.address || 'N/A'}</div>
                                                        </div>
                                                        <div>
                                                            <div className="font-medium">Estado</div>
                                                            <div className="text-muted-foreground">{client.connectionStatus || client.connection_status || 'N/A'}</div>
                                                        </div>
                                                        <div>
                                                            <div className="font-medium">Escena Actual</div>
                                                            <div className="text-muted-foreground">
                                                                {typeof client.currentScene === 'string' ? client.currentScene : (client.currentScene?.currentProgramSceneName || 'N/A')}
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <div className="font-medium">Última Actualización</div>
                                                            <div className="text-muted-foreground">
                                                                {client.lastSeen ? new Date(client.lastSeen).toLocaleTimeString() : 
                                                                 client.timestamp ? new Date(client.timestamp).toLocaleTimeString() : 'N/A'}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Controles de Streaming */}
                                                    <div className="flex gap-2 pt-4 border-t">
                                                        {/* Mostrar ambos botones con estados basados principalmente en isStreaming */}
                                                        <Button
                                                            onClick={startObsStream}
                                                            disabled={client.isStreaming || processing}
                                                            size="sm"
                                                            className="bg-green-600 hover:bg-green-700"
                                                        >
                                                            <Play className="mr-2 h-4 w-4" />
                                                            {processing ? 'Iniciando...' : 'Iniciar Stream'}
                                                        </Button>
                                                        
                                                        <Button
                                                            onClick={stopObsStream}
                                                            disabled={!client.isStreaming || processing}
                                                            size="sm"
                                                            variant="destructive"
                                                        >
                                                            <Square className="mr-2 h-4 w-4" />
                                                            {processing ? 'Deteniendo...' : 'Detener Stream'}
                                                        </Button>
                                                    </div>

                                                    {/* Cambio de Escenas */}
                                                    {client.scenes && client.scenes.length > 0 && (
                                                        <div className="pt-4 border-t">
                                                            <Label className="text-sm font-medium">Cambiar Escena</Label>
                                                            <div className="flex gap-2 mt-2">
                                                                <Select
                                                                    value={selectedScene}
                                                                    onValueChange={setSelectedScene}
                                                                    
                                                                >
                                                                    <SelectTrigger className="flex-1">
                                                                        <SelectValue placeholder="Seleccionar escena" />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        {client.scenes.map((scene) => (
                                                                            <SelectItem 
                                                                                key={scene.sceneName} 
                                                                                value={scene.sceneName}
                                                                            >
                                                                                {scene.sceneName}
                                                                            </SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                                <Button
                                                                    onClick={() => changeObsScene(client.id, selectedScene)}
                                                                    disabled={!selectedScene || processing}
                                                                    size="sm"
                                                                >
                                                                    Cambiar
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Información de Stream y Grabación */}
                                                    {(client.stream || client.record) && (
                                                        <div className="pt-4 border-t">
                                                            <Label className="text-sm font-medium mb-2 block">Estado de Salidas</Label>
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                                                                {client.stream && (
                                                                    <div className="p-3 border rounded-lg">
                                                                        <div className="font-medium text-sm mb-2">Stream</div>
                                                                        <div className="space-y-1">
                                                                            <div>Estado: <span className={client.stream.outputActive ? 'text-green-600' : 'text-gray-500'}>
                                                                                {client.stream.outputActive ? 'Activo' : 'Inactivo'}
                                                                            </span></div>
                                                                            <div>Bytes: {(client.stream.outputBytes / 1024 / 1024).toFixed(2)} MB</div>
                                                                            <div>Duración: {Math.floor(client.stream.outputDuration / 1000)}s</div>
                                                                            {client.stream.outputCongestion > 0 && (
                                                                                <div className="text-yellow-600">Congestión: {client.stream.outputCongestion.toFixed(1)}%</div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                                {client.record && (
                                                                    <div className="p-3 border rounded-lg">
                                                                        <div className="font-medium text-sm mb-2">Grabación</div>
                                                                        <div className="space-y-1">
                                                                            <div>Estado: <span className={client.record.outputActive ? 'text-red-600' : 'text-gray-500'}>
                                                                                {client.record.outputActive ? 'Grabando' : 'Detenido'}
                                                                            </span></div>
                                                                            <div>Bytes: {(client.record.outputBytes / 1024 / 1024).toFixed(2)} MB</div>
                                                                            <div>Timecode: {client.record.outputTimecode}</div>
                                                                            {client.record.outputPaused && (
                                                                                <div className="text-yellow-600">En pausa</div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Estadísticas del Cliente */}
                                                    {client.stats && (
                                                        <div className="pt-4 border-t">
                                                            <Label className="text-sm font-medium mb-2 block">Estadísticas</Label>
                                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                                                                {client.stats.fps && (
                                                                    <div>
                                                                        <div className="font-medium">FPS</div>
                                                                        <div className="text-muted-foreground">{client.stats.fps.toFixed(1)}</div>
                                                                    </div>
                                                                )}
                                                                {client.stats.cpuUsage && (
                                                                    <div>
                                                                        <div className="font-medium">CPU</div>
                                                                        <div className="text-muted-foreground">{client.stats.cpuUsage.toFixed(1)}%</div>
                                                                    </div>
                                                                )}
                                                                {client.stats.memoryUsage && (
                                                                    <div>
                                                                        <div className="font-medium">Memoria</div>
                                                                        <div className="text-muted-foreground">{(client.stats.memoryUsage / 1024 / 1024).toFixed(1)} MB</div>
                                                                    </div>
                                                                )}
                                                                {client.stats.freeDiskSpace && (
                                                                    <div>
                                                                        <div className="font-medium">Disco Libre</div>
                                                                        <div className="text-muted-foreground">{(client.stats.freeDiskSpace / 1024 / 1024 / 1024).toFixed(1)} GB</div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}
