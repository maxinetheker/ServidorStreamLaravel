import { PlaceholderPattern } from '@/components/ui/placeholder-pattern';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, useForm, usePage, router } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Copy, RefreshCw, Key, Monitor, Wifi, Settings, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Configuracion',
        href: '/configuracion',
    },
];

interface StreamKeyData {
    stream_key: string;
    is_active: boolean;
}

interface ObsConfigData {
    host: string;
    port: number;
    is_active: boolean;
}

interface ConfiguracionProps {
    streamKey: StreamKeyData | null;
    obsConfig: ObsConfigData | null;
    [key: string]: any; // Para satisfacer PageProps
}

export default function Configuracion() {
    const { props } = usePage<ConfiguracionProps>();
    const { streamKey: initialStreamKey, obsConfig: initialObsConfig } = props;
    
    const [streamKey, setStreamKey] = useState<string>(initialStreamKey?.stream_key || '');
    const [hasStreamKey, setHasStreamKey] = useState(!!initialStreamKey);

    // OBS Configuration state
    const [obsHost, setObsHost] = useState<string>(initialObsConfig?.host || 'localhost');
    const [obsPort, setObsPort] = useState<number>(initialObsConfig?.port || 4455);
    const [obsPassword, setObsPassword] = useState<string>('');
    const [hasObsConfig, setHasObsConfig] = useState(!!initialObsConfig);

    const { data, setData, post, processing } = useForm({});

    // Form for OBS configuration
    const { data: obsData, setData: setObsData, post: postObs, processing: processingObs, reset: resetObs } = useForm({
        host: obsHost,
        port: obsPort,
        password: obsPassword
    });

    // Escuchar los datos de flash después de generar/regenerar
    useEffect(() => {
        const flashData = props.flash as any;
        if (flashData?.streamKeyData) {
            setStreamKey(flashData.streamKeyData.stream_key);
            setHasStreamKey(true);
        }
        if (flashData?.success) {
            toast.success(flashData.success);
        }
    }, [props.flash]);

    // Actualizar cuando cambien las props iniciales (después de redirect)
    useEffect(() => {
        if (initialStreamKey?.stream_key) {
            setStreamKey(initialStreamKey.stream_key);
            setHasStreamKey(true);
        } else {
            setStreamKey('');
            setHasStreamKey(false);
        }

        if (initialObsConfig) {
            setObsHost(initialObsConfig.host);
            setObsPort(initialObsConfig.port);
            setHasObsConfig(true);
            setObsData({
                host: initialObsConfig.host,
                port: initialObsConfig.port,
                password: ''
            });
        } else {
            setHasObsConfig(false);
        }
    }, [initialStreamKey, initialObsConfig]);

    const generateStreamKey = () => {
        router.post('/api/stream-key/generate', {}, {
            replace: true,
            onError: (errors) => {
                console.error('Error al generar stream key:', errors);
                toast.error('Error al generar stream key');
            }
        });
    };

    const regenerateStreamKey = () => {
        router.post('/api/stream-key/regenerate', {}, {
            replace: true,
            onError: (errors) => {
                console.error('Error al regenerar stream key:', errors);
                toast.error('Error al regenerar stream key');
            }
        });
    };

    const copyToClipboard = async (text?: string) => {
        try {
            const textToCopy = text || streamKey;
            await navigator.clipboard.writeText(textToCopy);
            toast.success('Copiado al portapapeles');
        } catch (error) {
            console.error('Error al copiar:', error);
            toast.error('Error al copiar');
        }
    };

    const handleCopyStreamKey = () => copyToClipboard();

    // OBS Configuration handlers
    const handleObsSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        postObs('/api/obs-config', {
            onSuccess: (data) => {
                toast.success('Configuración OBS guardada correctamente');
                setHasObsConfig(true);
                setObsPassword(''); // Clear password after saving
                
                // Reload page to get updated data
                router.reload({ only: ['obsConfig'] });
            },
            onError: (errors) => {
                console.error('Error al guardar configuración OBS:', errors);
                toast.error('Error al guardar configuración OBS');
            }
        });
    };

    const deleteObsConfig = () => {
        router.delete('/api/obs-config', {
            onSuccess: () => {
                toast.success('Configuración OBS eliminada');
                setHasObsConfig(false);
                setObsHost('localhost');
                setObsPort(4455);
                setObsPassword('');
                resetObs();
            },
            onError: (errors) => {
                console.error('Error al eliminar configuración OBS:', errors);
                toast.error('Error al eliminar configuración OBS');
            }
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Configuración" />
            <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4 overflow-x-auto">
                <div className="grid auto-rows-min gap-4 md:grid-cols-1 max-w-4xl">
                    
                    {/* Stream Key Card */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Key className="h-5 w-5" />
                                Stream Key
                            </CardTitle>
                            <CardDescription>
                                Genera y gestiona tu clave de transmisión única. Esta clave de 32 caracteres es necesaria para conectar tu software de streaming.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {hasStreamKey ? (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="streamkey">Tu Stream Key</Label>
                                        <div className="flex gap-2">
                                            <Input
                                                id="streamkey"
                                                type="text"
                                                value={streamKey}
                                                readOnly
                                                className="font-mono"
                                            />
                                            <Button 
                                                variant="outline" 
                                                size="icon"
                                                onClick={handleCopyStreamKey}
                                                title="Copiar al portapapeles"
                                            >
                                                <Copy className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                    
                                    <div className="flex gap-2">
                                        <Button 
                                            variant="outline"
                                            onClick={regenerateStreamKey}
                                            disabled={processing}
                                            className="flex items-center gap-2"
                                        >
                                            <RefreshCw className={`h-4 w-4 ${processing ? 'animate-spin' : ''}`} />
                                            Regenerar Stream Key
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center space-y-4">
                                    <p className="text-muted-foreground">
                                        No tienes un stream key generado. Haz clic en el botón para crear uno.
                                    </p>
                                    <Button 
                                        onClick={generateStreamKey}
                                        disabled={processing}
                                        className="flex items-center gap-2"
                                    >
                                        <Key className="h-4 w-4" />
                                        {processing ? 'Generando...' : 'Generar Stream Key'}
                                    </Button>
                                </div>
                            )}
                            
                            {hasStreamKey && streamKey && (
                                <div className="mt-6 space-y-4">
                                    <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                                        <h4 className="font-medium mb-3 text-blue-900 dark:text-blue-100">📺 URLs de Transmisión</h4>
                                        
                                        <div className="space-y-3">
                                            <div>
                                                <Label className="text-sm font-medium text-blue-800 dark:text-blue-200">
                                                    Para visualizar el contenido:
                                                </Label>
                                                <div className="flex gap-2 mt-1">
                                                    <Input
                                                        type="text"
                                                        value={`https://streamff.repo.net.pe/live?key=${streamKey}`}
                                                        readOnly
                                                        className="font-mono text-xs bg-white dark:bg-gray-900"
                                                    />
                                                    <Button 
                                                        variant="outline" 
                                                        size="icon"
                                                        onClick={() => copyToClipboard(`https://streamff.repo.net.pe/live?key=${streamKey}`)}
                                                        title="Copiar URL de visualización"
                                                    >
                                                        <Copy className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                            
                                            <div>
                                                <Label className="text-sm font-medium text-blue-800 dark:text-blue-200">
                                                    Para transmitir desde tu dispositivo:
                                                </Label>
                                                <div className="mt-1 space-y-2">
                                                    <div>
                                                        <Label className="text-xs text-blue-700 dark:text-blue-300">URL del servidor:</Label>
                                                        <div className="flex gap-2">
                                                            <Input
                                                                type="text"
                                                                value="rtmps://live.repo.net.pe/live/"
                                                                readOnly
                                                                className="font-mono text-xs bg-white dark:bg-gray-900"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <Label className="text-xs text-blue-700 dark:text-blue-300">Stream Key:</Label>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                            
                            <div className="mt-4 p-4 bg-muted rounded-lg">
                                <h4 className="font-medium mb-2">Instrucciones de uso:</h4>
                                <ul className="text-sm text-muted-foreground space-y-1">
                                    <li>• <strong>OBS Studio:</strong> Ve a Configuración → Stream → Servicio personalizado</li>
                                    <li>• <strong>Servidor:</strong> rtmp://live.repo.net.pe/live/</li>
                                    <li>• <strong>Clave de Stream:</strong> Usa tu stream key generado</li>
                                    <li>• <strong>Visualización:</strong> Comparte la URL de visualización con tu audiencia</li>
                                    <li>• <strong>Seguridad:</strong> Mantén tu stream key privado y regénéralo si es necesario</li>
                                </ul>
                            </div>
                        </CardContent>
                    </Card>

                    {/* OBS Configuration Card */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Monitor className="h-5 w-5" />
                                Configuración OBS WebSocket
                            </CardTitle>
                            <CardDescription>
                                Configura la conexión WebSocket para controlar OBS Studio remotamente. Asegúrate de que OBS tenga habilitado el plugin WebSocket con la misma configuración.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <form onSubmit={handleObsSubmit} className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="obsHost">Host / IP</Label>
                                        <Input
                                            id="obsHost"
                                            type="text"
                                            value={obsHost}
                                            onChange={(e) => {
                                                setObsHost(e.target.value);
                                                setObsData('host', e.target.value);
                                            }}
                                            placeholder="localhost"
                                            required
                                        />
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <Label htmlFor="obsPort">Puerto</Label>
                                        <Input
                                            id="obsPort"
                                            type="number"
                                            value={obsPort}
                                            onChange={(e) => {
                                                const port = parseInt(e.target.value);
                                                setObsPort(port);
                                                setObsData('port', port);
                                            }}
                                            placeholder="4455"
                                            min="1"
                                            max="65535"
                                            required
                                        />
                                    </div>
                                </div>
                                
                                <div className="space-y-2">
                                    <Label htmlFor="obsPassword">Contraseña WebSocket</Label>
                                    <Input
                                        id="obsPassword"
                                        type="password"
                                        value={obsPassword}
                                        onChange={(e) => {
                                            setObsPassword(e.target.value);
                                            setObsData('password', e.target.value);
                                        }}
                                        placeholder="Ingresa la contraseña configurada en OBS"
                                        required
                                    />
                                </div>
                                
                                <div className="flex gap-2">
                                    <Button 
                                        type="submit"
                                        disabled={processingObs}
                                        className="flex items-center gap-2"
                                    >
                                        <Settings className={`h-4 w-4 ${processingObs ? 'animate-spin' : ''}`} />
                                        {hasObsConfig ? 'Actualizar Configuración' : 'Guardar Configuración'}
                                    </Button>
                                    
                                    {hasObsConfig && (
                                        <Button 
                                            type="button"
                                            variant="destructive"
                                            onClick={deleteObsConfig}
                                            disabled={processingObs}
                                            className="flex items-center gap-2"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                            Eliminar
                                        </Button>
                                    )}
                                </div>
                            </form>
                            
                            {hasObsConfig && (
                                <div className="mt-6 p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                                    <h4 className="font-medium mb-3 text-green-900 dark:text-green-100 flex items-center gap-2">
                                        <Wifi className="h-4 w-4" />
                                        Configuración Actual
                                    </h4>
                                    <div className="space-y-2 text-sm">
                                        <div><strong>Host:</strong> {obsHost}</div>
                                        <div><strong>Puerto:</strong> {obsPort}</div>
                                        <div><strong>Estado:</strong> {hasObsConfig ? 'Configurado' : 'No configurado'}</div>
                                    </div>
                                </div>
                            )}
                            
                            <div className="mt-4 p-4 bg-muted rounded-lg">
                                <h4 className="font-medium mb-2">Instrucciones para OBS Studio:</h4>
                                <ul className="text-sm text-muted-foreground space-y-1">
                                    <li>• <strong>Habilitar WebSocket:</strong> Ve a Herramientas → WebSocket Server Settings</li>
                                    <li>• <strong>Puerto:</strong> Asegúrate de que coincida con el puerto configurado aquí ({obsPort})</li>
                                    <li>• <strong>Contraseña:</strong> Configura la misma contraseña en OBS</li>
                                    <li>• <strong>Fuente Navegador:</strong> Agrega una fuente navegador con URL: https://streamff.repo.net.pe/live?key={streamKey}</li>
                                    <li>• <strong>Control Remoto:</strong> Una vez configurado, podrás controlar OBS desde la página "Streaming Tool"</li>
                                </ul>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AppLayout>
    );
}
