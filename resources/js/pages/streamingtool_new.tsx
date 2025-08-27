import { PlaceholderPattern } from '@/components/ui/placeholder-pattern';
import { Switch } from '@/components/ui/switch';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, useForm, usePage } from '@inertiajs/react';
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

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Streaming Tool',
        href: '/streamingtool',
    },
];

interface ObsClient {
    id: string;
    status: 'connected' | 'disconnected' | 'error';
    isStreaming: boolean;
    isRecording: boolean;
    currentScene: string;
    scenes: string[];
    connectionStatus: string;
    address?: string;
    lastSeen?: string;
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
    [key: string]: any; // Para satisfacer PageProps
}

export default function StreamingTool() {
    const { props } = usePage<StreamingToolProps>();
    const { hasStreamKey, streamKey, hasObsConfig, obsConfig } = props;

    const [obsClients, setObsClients] = useState<ObsClient[]>([]);
    const [isLoadingStatus, setIsLoadingStatus] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [selectedClient, setSelectedClient] = useState<string>('');
    const [selectedScene, setSelectedScene] = useState<string>('');

    // useForm para operaciones que requieren POST/PUT/DELETE
    const { data, setData, post, processing, reset } = useForm({
        sceneName: ''
    });

    // Función para obtener el estado de los clientes OBS (GET request con fetch)
    const getObsStatus = async () => {
        if (!hasStreamKey) {
            toast.error('Necesitas generar un stream key primero');
            return;
        }

        setIsLoadingStatus(true);
        try {
            // Obtener CSRF token
            const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
            
            const response = await fetch('/api/obs/status', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': token || '',
                    'X-Requested-With': 'XMLHttpRequest',
                },
            });

            const responseData = await response.json();
            
            if (responseData.success) {
                setObsClients(responseData.clients || []);
                toast.success(responseData.message || 'Estado actualizado');
            } else {
                setObsClients([]);
                toast.error(responseData.message || 'Error al obtener estado');
            }
        } catch (error) {
            console.error('Error al obtener estado OBS:', error);
            setObsClients([]);
            toast.error('Error al obtener estado de OBS');
        } finally {
            setIsLoadingStatus(false);
        }
    };

    // Función para conectar OBS usando useForm
    const connectObs = () => {
        if (!hasObsConfig) {
            toast.error('Necesitas configurar OBS WebSocket primero');
            return;
        }

        setIsConnecting(true);
        post('/api/obs/connect', {
            preserveScroll: true,
            onSuccess: (page) => {
                const responseData = page.props as any;
                if (responseData.success) {
                    toast.success(responseData.message || 'OBS conectado exitosamente');
                    // Actualizar estado después de conectar
                    setTimeout(() => getObsStatus(), 2000);
                } else {
                    toast.error(responseData.message || 'Error al conectar OBS');
                }
            },
            onError: (errors) => {
                console.error('Error al conectar OBS:', errors);
                toast.error('Error al conectar OBS');
            },
            onFinish: () => setIsConnecting(false)
        });
    };

    // Función para iniciar stream usando useForm
    const startObsStream = () => {
        post('/api/obs/start-stream', {
            preserveScroll: true,
            onSuccess: (page) => {
                const responseData = page.props as any;
                if (responseData.success) {
                    toast.success(responseData.message || 'Stream iniciado exitosamente');
                    // Actualizar estado después de iniciar
                    setTimeout(() => getObsStatus(), 1000);
                } else {
                    toast.error(responseData.message || 'Error al iniciar stream');
                }
            },
            onError: (errors) => {
                console.error('Error al iniciar stream:', errors);
                toast.error('Error al iniciar stream');
            }
        });
    };

    // Función para detener stream usando useForm
    const stopObsStream = () => {
        post('/api/obs/stop-stream', {
            preserveScroll: true,
            onSuccess: (page) => {
                const responseData = page.props as any;
                if (responseData.success) {
                    toast.success(responseData.message || 'Stream detenido exitosamente');
                    // Actualizar estado después de detener
                    setTimeout(() => getObsStatus(), 1000);
                } else {
                    toast.error(responseData.message || 'Error al detener stream');
                }
            },
            onError: (errors) => {
                console.error('Error al detener stream:', errors);
                toast.error('Error al detener stream');
            }
        });
    };

    // Función para cambiar escena usando useForm
    const changeObsScene = (clientId: string, sceneName: string) => {
        if (!clientId || !sceneName) {
            toast.error('Selecciona un cliente y una escena');
            return;
        }

        setData('sceneName', sceneName);
        post('/api/obs/change-scene', {
            preserveScroll: true,
            onSuccess: (page) => {
                const responseData = page.props as any;
                if (responseData.success) {
                    toast.success(responseData.message || 'Escena cambiada exitosamente');
                    // Actualizar estado después del cambio
                    setTimeout(() => getObsStatus(), 1000);
                } else {
                    toast.error(responseData.message || 'Error al cambiar escena');
                }
            },
            onError: (errors) => {
                console.error('Error al cambiar escena:', errors);
                toast.error('Error al cambiar escena');
            }
        });
    };

    // Efecto para cargar estado inicial
    useEffect(() => {
        if (hasStreamKey && hasObsConfig) {
            getObsStatus();
        }
    }, [hasStreamKey, hasObsConfig]);

    // Auto-refresh cada 30 segundos
    useEffect(() => {
        if (hasStreamKey && hasObsConfig) {
            const interval = setInterval(() => {
                getObsStatus();
            }, 30000);

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

                                {/* Clientes Conectados */}
                                <div className="flex items-center justify-between p-3 border rounded-lg">
                                    <div className="flex items-center gap-2">
                                        <Wifi className="h-4 w-4" />
                                        <span className="text-sm font-medium">Clientes OBS</span>
                                    </div>
                                    <Badge variant={obsClients.length > 0 ? "default" : "secondary"}>
                                        {obsClients.length} conectado{obsClients.length !== 1 ? 's' : ''}
                                    </Badge>
                                </div>
                            </div>

                            {(!hasStreamKey || !hasObsConfig) && (
                                <Alert>
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertDescription>
                                        {!hasStreamKey && !hasObsConfig 
                                            ? 'Necesitas configurar un Stream Key y OBS WebSocket antes de usar esta herramienta.'
                                            : !hasStreamKey 
                                            ? 'Necesitas generar un Stream Key en la página de Configuración.'
                                            : 'Necesitas configurar OBS WebSocket en la página de Configuración.'
                                        }
                                    </AlertDescription>
                                </Alert>
                            )}
                        </CardContent>
                    </Card>

                    {/* Control de OBS */}
                    {hasStreamKey && hasObsConfig && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Video className="h-5 w-5" />
                                    Control de OBS
                                </CardTitle>
                                <CardDescription>
                                    Gestiona tus clientes OBS conectados y controla el streaming
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {/* Botones de Control */}
                                <div className="flex flex-wrap gap-2">
                                    <Button 
                                        onClick={getObsStatus}
                                        disabled={isLoadingStatus}
                                        variant="outline"
                                        className="flex items-center gap-2"
                                    >
                                        <RefreshCw className={`h-4 w-4 ${isLoadingStatus ? 'animate-spin' : ''}`} />
                                        Actualizar Estado
                                    </Button>
                                    
                                    <Button 
                                        onClick={connectObs}
                                        disabled={isConnecting || processing}
                                        className="flex items-center gap-2"
                                    >
                                        <Wifi className={`h-4 w-4 ${isConnecting ? 'animate-pulse' : ''}`} />
                                        {isConnecting ? 'Conectando...' : 'Conectar OBS'}
                                    </Button>
                                    
                                    <Button 
                                        onClick={startObsStream}
                                        disabled={processing || obsClients.filter(c => c.status === 'connected').length === 0}
                                        className="flex items-center gap-2"
                                    >
                                        <Play className="h-4 w-4" />
                                        Iniciar Stream
                                    </Button>
                                    
                                    <Button 
                                        onClick={stopObsStream}
                                        disabled={processing || obsClients.filter(c => c.isStreaming).length === 0}
                                        variant="destructive"
                                        className="flex items-center gap-2"
                                    >
                                        <Square className="h-4 w-4" />
                                        Detener Stream
                                    </Button>
                                </div>

                                {/* Lista de Clientes OBS */}
                                {obsClients.length > 0 ? (
                                    <div className="space-y-4">
                                        <h4 className="font-medium">Clientes OBS Conectados:</h4>
                                        {obsClients.map((client) => (
                                            <div key={client.id} className="border rounded-lg p-4 space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <Monitor className="h-4 w-4" />
                                                        <span className="font-medium">Cliente {client.id}</span>
                                                        {client.address && (
                                                            <span className="text-sm text-muted-foreground">
                                                                ({client.address})
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Badge 
                                                            variant={
                                                                client.status === 'connected' ? 'default' : 
                                                                client.status === 'error' ? 'destructive' : 'secondary'
                                                            }
                                                        >
                                                            {client.status === 'connected' ? 'Conectado' : 
                                                             client.status === 'error' ? 'Error' : 'Desconectado'}
                                                        </Badge>
                                                        {client.isStreaming && (
                                                            <Badge variant="destructive">
                                                                <div className="flex items-center gap-1">
                                                                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                                                                    Streaming
                                                                </div>
                                                            </Badge>
                                                        )}
                                                        {client.isRecording && (
                                                            <Badge variant="secondary">
                                                                Grabando
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </div>
                                                
                                                {client.status === 'connected' && (
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <div>
                                                            <Label className="text-sm font-medium">Escena Actual:</Label>
                                                            <p className="text-sm text-muted-foreground">{client.currentScene || 'No disponible'}</p>
                                                        </div>
                                                        
                                                        {client.scenes && client.scenes.length > 0 && (
                                                            <div>
                                                                <Label className="text-sm font-medium">Cambiar Escena:</Label>
                                                                <Select
                                                                    value={selectedScene}
                                                                    onValueChange={(value) => {
                                                                        setSelectedScene(value);
                                                                        changeObsScene(client.id, value);
                                                                    }}
                                                                >
                                                                    <SelectTrigger className="w-full">
                                                                        <SelectValue placeholder="Seleccionar escena" />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        {client.scenes.map((scene) => (
                                                                            <SelectItem key={scene} value={scene}>
                                                                                {scene}
                                                                            </SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                                
                                                {client.lastSeen && (
                                                    <div className="text-xs text-muted-foreground">
                                                        Última actividad: {client.lastSeen}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-8 text-muted-foreground">
                                        <Monitor className="h-12 w-12 mx-auto mb-4 opacity-20" />
                                        <p>No hay clientes OBS conectados</p>
                                        <p className="text-sm">Haz clic en "Conectar OBS" para buscar clientes</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {/* Información de Configuración */}
                    {hasStreamKey && streamKey && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Eye className="h-5 w-5" />
                                    Información de Stream
                                </CardTitle>
                                <CardDescription>
                                    URLs e información útil para tu transmisión
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-3">
                                    <div>
                                        <Label className="text-sm font-medium">URL de Visualización:</Label>
                                        <div className="flex gap-2 mt-1">
                                            <Input
                                                type="text"
                                                value={`https://streamff.repo.net.pe/live?key=${streamKey}`}
                                                readOnly
                                                className="font-mono text-xs"
                                            />
                                            <Button 
                                                variant="outline" 
                                                size="icon"
                                                onClick={() => {
                                                    navigator.clipboard.writeText(`https://streamff.repo.net.pe/live?key=${streamKey}`);
                                                    toast.success('URL copiada al portapapeles');
                                                }}
                                            >
                                                <Copy className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                    
                                    {hasObsConfig && obsConfig && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <Label className="text-sm font-medium">OBS WebSocket Host:</Label>
                                                <p className="text-sm text-muted-foreground">{obsConfig.host}:{obsConfig.port}</p>
                                            </div>
                                            <div>
                                                <Label className="text-sm font-medium">Estado OBS:</Label>
                                                <p className="text-sm text-muted-foreground">
                                                    {obsConfig.is_active ? 'Activo' : 'Inactivo'}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}
