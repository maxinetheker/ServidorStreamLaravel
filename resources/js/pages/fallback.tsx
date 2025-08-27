import React, { useState, useRef, useEffect } from 'react';
import { PlaceholderPattern } from '@/components/ui/placeholder-pattern';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2, Upload, Play, Pause, Loader2 } from 'lucide-react';
import Swal from 'sweetalert2';

// Modal de carga
const LoadingModal = ({ isOpen, message }: { isOpen: boolean; message: string }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg max-w-sm w-full mx-4">
                <div className="flex items-center space-x-3">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{message}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Por favor espera, esto puede tomar unos minutos...
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

// SweetAlert2 toast utility
const toast = {
    success: (message: string) => {
        Swal.fire({
            title: '¡Éxito!',
            text: message,
            icon: 'success',
            confirmButtonText: 'Aceptar',
            timer: 3000,
            timerProgressBar: true
        });
    },
    error: (message: string) => {
        Swal.fire({
            title: 'Error',
            text: message,
            icon: 'error',
            confirmButtonText: 'Aceptar'
        });
    }
};

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Control',
        href: '/control',
    },
];

interface Video {
    id: number;
    id_usuario: number;
    ruta: string;
    nombre_original: string;
    mime_type: string;
    tamaño: number;
    created_at: string;
    updated_at: string;
    url?: string;
}

interface ServerLimits {
    upload_max_filesize: string;
    post_max_size: string;
    upload_max_bytes: number;
    post_max_bytes: number;
}

interface Props {
    videos: Video[];
    serverLimits?: ServerLimits;
    flash?: {
        success?: string;
        error?: string;
    };
    errors?: Record<string, string>;
}

export default function Fallback({ videos: initialVideos, serverLimits, flash, errors }: Props) {
    const [videos, setVideos] = useState<Video[]>(initialVideos || []);
    const [playingVideoId, setPlayingVideoId] = useState<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Estado para interfaz previa
    const [previewFile, setPreviewFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [uploadProgress, setUploadProgress] = useState<number>(0);

    const { data, setData, post, processing, reset } = useForm({
        video: null as Blob | null,
    });

    // Limpia URL de previsualización al desmontar
    useEffect(() => {
        return () => {
            if (previewUrl) URL.revokeObjectURL(previewUrl);
        };
    }, [previewUrl]);

    // Efecto para controlar la reproducción de videos
    useEffect(() => {
        // Pausar todos los videos cuando playingVideoId cambie
        const allVideos = document.querySelectorAll('video[data-video-id]') as NodeListOf<HTMLVideoElement>;
        allVideos.forEach(video => {
            const videoId = parseInt(video.getAttribute('data-video-id') || '0');
            if (videoId !== playingVideoId) {
                video.pause();
            }
        });
    }, [playingVideoId]);

    // Mostrar mensajes de flash
    useEffect(() => {
        if (flash?.success) {
            toast.success(flash.success);
        }
        if (flash?.error) {
            toast.error(flash.error);
        }
        if (errors?.video) {
            toast.error(errors.video);
        }
        if (errors?.error) {
            toast.error(errors.error);
        }
    }, [flash, errors]);

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) {
            console.log('No file selected');
            return;
        }

        console.log('File selected:', file.name, file.size, file.type);
        

        // Validación de tipo
        const allowedTypes = ['video/mp4', 'video/avi', 'video/quicktime', 'video/x-msvideo', 'video/webm'];
        if (!allowedTypes.includes(file.type) && !file.name.match(/\.(mp4|avi|mov|mkv|wmv|flv|webm)$/i)) {
            toast.error('Formato de video no soportado.');
            return;
        }

        // Guardar inmediatamente en useForm (File es un Blob válido)
        setData('video', file);
        setPreviewFile(file);
        // Crear URL de previsualización
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
        setUploadProgress(0);
    };

    const cancelarPrevia = () => {
        if (fileInputRef.current) fileInputRef.current.value = '';
        setPreviewFile(null);
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
        setData('video', null);
        setUploadProgress(0);
    };

    const subirVideo = () => {
        if (!previewFile) return;
        
        post('/api/videos', {
            forceFormData: true,
            onStart: () => {
                console.log('Upload started');
                setUploadProgress(0);
            },
            onProgress: (progress) => {
                if (progress?.percentage) {
                    setUploadProgress(progress.percentage);
                }
            },
            onSuccess: (page: any) => {
                console.log('Upload success response:', page);
                
                // Si la respuesta incluye videos actualizados, usarlos
                if (page?.props?.videos) {
                    setVideos(page.props.videos);
                } else {
                    // Si no, recargar la página para obtener los videos actualizados
                    router.get('/fallback', {}, { 
                        preserveState: false, 
                        preserveScroll: true, 
                        only: ['videos'],
                        onSuccess: (page: any) => {
                            if (page?.props?.videos) {
                                setVideos(page.props.videos);
                            }
                        }
                    });
                }
                
                cancelarPrevia();
                reset();
                toast.success('Video subido correctamente');
            },
            onError: (errs) => {
                console.error('Upload errors:', errs);
                // Mostrar errores específicos
                if (errs.video) {
                    toast.error(errs.video);
                } else if (errs.error) {
                    toast.error(errs.error);
                } else {
                    toast.error('Error al subir el video');
                }
            },
            onFinish: () => {
                console.log('Upload finished');
                setUploadProgress(0);
            }
        });
    };

    const deleteVideo = (videoId: number) => {
        Swal.fire({
            title: '¿Estás seguro?',
            text: "¿Quieres eliminar este video? Esta acción no se puede deshacer.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar'
        }).then((result) => {
            if (result.isConfirmed) {
                router.delete(`/api/videos/${videoId}`, {
                    onStart: () => {
                        console.log('Delete started for video:', videoId);
                    },
                    onSuccess: (page: any) => {
                        console.log('Delete success');
                        
                        // Si se está reproduciendo el video eliminado, detener reproducción
                        if (playingVideoId === videoId) {
                            setPlayingVideoId(null);
                        }
                        
                        // Actualizar lista de videos eliminando el video borrado
                        setVideos(prevVideos => prevVideos.filter(video => video.id !== videoId));
                        toast.success('Video eliminado correctamente');
                    },
                    onError: (errs) => {
                        console.error('Delete errors:', errs);
                        if (errs.error) {
                            toast.error(errs.error);
                        } else {
                            toast.error('Error al eliminar el video');
                        }
                    },
                });
            }
        });
    };

    const toggleVideoPlayback = (videoId: number) => {
        const videoElement = document.querySelector(`video[data-video-id="${videoId}"]`) as HTMLVideoElement;
        
        if (playingVideoId === videoId) {
            // Pausar el video actual
            if (videoElement) {
                videoElement.pause();
            }
            setPlayingVideoId(null);
        } else {
            // Pausar cualquier video que esté reproduciendo
            if (playingVideoId !== null) {
                const currentlyPlaying = document.querySelector(`video[data-video-id="${playingVideoId}"]`) as HTMLVideoElement;
                if (currentlyPlaying) {
                    currentlyPlaying.pause();
                }
            }
            
            // Reproducir el nuevo video
            if (videoElement) {
                videoElement.play().catch(error => {
                    console.error('Error playing video:', error);
                    toast.error('Error al reproducir el video');
                });
            }
            setPlayingVideoId(videoId);
        }
    };

    const formatFileSize = (bytes: number): string => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const formatDate = (dateString: string): string => {
        return new Date(dateString).toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Videos de Respaldo" />
            <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4 overflow-x-auto">
                
                {/* Header con botón de subida */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold">Videos de Respaldo</h1>
                        <p className="text-muted-foreground">
                            Gestiona tus videos de respaldo que se mostrarán cuando no haya transmisión en vivo
                        </p>
                    </div>
                    
                    <div className="flex gap-2">
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="video/*"
                            onChange={handleFileSelect}
                            className="hidden"
                            disabled={processing}
                        />
                        
                        <Button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={processing}
                            className="flex items-center gap-2"
                        >
                            <Upload className="h-4 w-4" />
                            {processing ? 'Subiendo...' : 'Subir Video'}
                        </Button>
                    </div>
                </div>

                {/* Grid de videos */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {videos.length === 0 ? (
                        <div className="col-span-full flex flex-col items-center justify-center py-12">
                            <PlaceholderPattern />
                            <h3 className="mt-4 text-lg font-semibold">No hay videos</h3>
                            <p className="text-muted-foreground">Sube tu primer video de respaldo</p>
                        </div>
                    ) : (
                        videos.map((video) => (
                            <Card key={video.id} className="overflow-hidden">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm truncate" title={video.nombre_original}>
                                        {video.nombre_original}
                                    </CardTitle>
                                </CardHeader>
                                
                                <CardContent className="space-y-3">
                                    {/* Video preview */}
                                    <div className="relative aspect-video bg-muted rounded-md overflow-hidden">
                                        <video
                                            src={`/storage/${video.ruta}`}
                                            data-video-id={video.id}
                                            className="w-full h-full object-cover"
                                            controls={playingVideoId === video.id}
                                            muted={false}
                                            loop
                                            playsInline
                                            onLoadedData={(e) => {
                                                if (playingVideoId === video.id) {
                                                    (e.target as HTMLVideoElement).play().catch(error => {
                                                        console.error('Error auto-playing video:', error);
                                                    });
                                                }
                                            }}
                                            onPlay={() => {
                                                if (playingVideoId !== video.id) {
                                                    setPlayingVideoId(video.id);
                                                }
                                            }}
                                            onPause={() => {
                                                if (playingVideoId === video.id) {
                                                    setPlayingVideoId(null);
                                                }
                                            }}
                                        />
                                        
                                        {playingVideoId !== video.id && (
                                            <div 
                                                className="video-overlay absolute inset-0 bg-black/30 flex items-center justify-center cursor-pointer hover:bg-black/50 transition-colors"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleVideoPlayback(video.id);
                                                }}
                                            >
                                                <div className="bg-white/20 rounded-full p-4 backdrop-blur-sm">
                                                    <Play className="h-8 w-8 text-white fill-white" />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    
                                    {/* Video info */}
                                    <div className="space-y-2 text-sm text-muted-foreground">
                                        <div className="flex justify-between">
                                            <span>Tamaño:</span>
                                            <span>{formatFileSize(video.tamaño)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Subido:</span>
                                            <span>{formatDate(video.created_at)}</span>
                                        </div>
                                    </div>
                                    
                                    {/* Actions */}
                                    <div className="flex gap-2 pt-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => toggleVideoPlayback(video.id)}
                                            className="flex-1"
                                        >
                                            {playingVideoId === video.id ? (
                                                <>
                                                    <Pause className="h-4 w-4 mr-2" />
                                                    Pausar
                                                </>
                                            ) : (
                                                <>
                                                    <Play className="h-4 w-4 mr-2" />
                                                    Reproducir
                                                </>
                                            )}
                                        </Button>
                                        
                                        <Button
                                            variant="destructive"
                                            size="sm"
                                            onClick={() => deleteVideo(video.id)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>
            </div>
            
            {/* Modal de carga */}
            <LoadingModal 
                isOpen={processing} 
                message="Procesando video..." 
            />

            {/* Interfaz previa de subida */}
            {previewFile && previewUrl && !processing && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-xl overflow-hidden">
                        <div className="p-4 border-b border-border flex items-center justify-between">
                            <h2 className="font-semibold text-lg">Confirmar subida</h2>
                            <button onClick={cancelarPrevia} className="text-sm text-muted-foreground hover:text-foreground">✕</button>
                        </div>
                        <div className="p-4 space-y-4">
                            <div className="aspect-video bg-muted rounded-md overflow-hidden">
                                <video src={previewUrl} controls className="w-full h-full object-contain" />
                            </div>
                            <div className="text-sm space-y-1">
                                <p><span className="font-medium">Archivo:</span> {previewFile.name}</p>
                                <p><span className="font-medium">Tamaño:</span> {formatFileSize(previewFile.size)}</p>
                                <p><span className="font-medium">Tipo:</span> {previewFile.type || 'desconocido'}</p>
                            </div>
                            {uploadProgress > 0 && (
                                <div className="w-full bg-muted rounded h-2 overflow-hidden">
                                    <div
                                        className="h-2 bg-blue-600 transition-all"
                                        style={{ width: `${uploadProgress}%` }}
                                    />
                                </div>
                            )}
                            <div className="flex gap-2 justify-end pt-2">
                                <Button type="button" variant="outline" disabled={processing} onClick={cancelarPrevia}>
                                    Cancelar
                                </Button>
                                <Button type="button" disabled={processing} onClick={subirVideo}>
                                    {uploadProgress > 0 && uploadProgress < 100 ? `Subiendo ${uploadProgress}%` : 'Confirmar Subida'}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
