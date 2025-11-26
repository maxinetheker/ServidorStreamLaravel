import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import OBSWebSocket from 'obs-websocket-js';
import Hls from 'hls.js';

// OBS WebSocket types
interface ObsStatus {
    stream: any;
    record: any;
    currentScene: any;
    scenes: any[];
}

declare global {
    interface Window {
        webkitAudioContext?: typeof AudioContext;
    }
}

interface Status {
    text: string;
    active: boolean;
}



interface LiveProps {
    streamKey: string;
}

const Live: React.FC<LiveProps> = ({ streamKey }) => {
    // Environment variables centralizadas
    const NGINX_IP = 'live.repo.net.pe'; // Cambiar según entorno
    const SOCKET_URL = `https://manager.live.repo.net.pe`;
    const STREAM_KEY = streamKey;
    const HLS_BASE_URL = `https://live.repo.net.pe`; // NGINX sirve HLS en puerto 443 (HTTPS)
    // Activar debug de HLS.js añadiendo `?hls_debug=1` a la URL
    const HLS_DEBUG = (typeof window !== 'undefined') && window.location.search.includes('hls_debug=1');

    // Video references
    const rtmpVideoRef = useRef<HTMLVideoElement | null>(null);
    const localVideoRef = useRef<HTMLVideoElement | null>(null);

    // Socket reference
    const socketRef = useRef<Socket | null>(null);

    // HLS reference
    const rtmpHlsRef = useRef<Hls | null>(null);

    const hlsInitializingRef = useRef<boolean>(false);
    const hlsReadyRef = useRef<boolean>(false);
    // Abort controller ref for HLS polling to avoid overlapping fetches
    const hlsCheckAbortRef = useRef<AbortController | null>(null);

    // OBS WebSocket reference
    const obsWsRef = useRef<OBSWebSocket | null>(null);

    // Intervals
    const forcedMuteIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // State
    const [isRtmpAvailable, setIsRtmpAvailable] = useState<boolean>(false);
    const [currentVideoIndex, setCurrentVideoIndex] = useState<number>(0);
    const [videosList, setVideosList] = useState<string[]>([]);
    const [audioEnabled, setAudioEnabled] = useState<boolean>(true);
    const [showingRtmp, setShowingRtmp] = useState<boolean>(false);
    const [userHasInteracted, setUserHasInteracted] = useState<boolean>(true);
    const [rtmpStatus, setRtmpStatus] = useState<Status>({ text: 'Desconectado', active: false });
    const [localStatus, setLocalStatus] = useState<Status>({ text: 'Activo', active: true });
    const [isWaitingForStream, setIsWaitingForStream] = useState<boolean>(false);
    const [waitingMessage, setWaitingMessage] = useState<string>('Esperando stream...');
    const [isLowBandwidth, setIsLowBandwidth] = useState<boolean>(false); // NUEVO: Estado para advertencia de ancho de banda

    // Estados para monitoreo RTMP
    const [rtmpStatusMonitor, setRtmpStatusMonitor] = useState<string>('UNKNOWN');
    const [lastRtmpCheck, setLastRtmpCheck] = useState<Date | null>(null);

    // Refs para control de monitoreo
    const rtmpStatusIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const isMonitoringRtmpRef = useRef<boolean>(false);

    // Playback health monitoring refs
    const playbackHealthIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const lastTimeRef = useRef<number>(0);
    const stagnantCounterRef = useRef<number>(0);
    const lastStallRecoveryRef = useRef<number>(0);
    const lastBufferLogRef = useRef<number>(0);

    // Función para consultar estado RTMP
    const checkRtmpStatus = async () => {
        try {
            const response = await fetch(`${SOCKET_URL}/api/stream/rtmp-status/${STREAM_KEY}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                console.log(' Estado RTMP consultado:', data);

                setLastRtmpCheck(new Date());

                if (data.rtmpActive) {
                    setRtmpStatusMonitor('ACTIVE');
                    if (!isRtmpAvailable) {
                        console.log(' RTMP detectado como activo, actualizando estado');
                        handleRtmpStatusChange(true);
                    }
                } else {
                    setRtmpStatusMonitor('INACTIVE');
                    if (isRtmpAvailable) {
                        console.log(' RTMP detectado como inactivo, actualizando estado');
                        handleRtmpStatusChange(false);
                    }
                }

                return data;
            }
        } catch (error) {
            console.error(' Error consultando estado RTMP:', error);
            setRtmpStatusMonitor('ERROR');
        }
        return null;
    };

    // NUEVO: Iniciar monitoreo periódico de RTMP
    const startRtmpMonitoring = () => {
        if (isMonitoringRtmpRef.current) {
            console.log(' Monitoreo RTMP ya está activo');
            return;
        }

        console.log(' Iniciando monitoreo periódico de estado RTMP');
        isMonitoringRtmpRef.current = true;

        // Verificar inmediatamente
        checkRtmpStatus();

        // Verificar cada 10 segundos
        rtmpStatusIntervalRef.current = setInterval(checkRtmpStatus, 10000);
    };

    // NUEVO: Detener monitoreo RTMP
    const stopRtmpMonitoring = () => {
        if (rtmpStatusIntervalRef.current) {
            clearInterval(rtmpStatusIntervalRef.current);
            rtmpStatusIntervalRef.current = null;
        }
        isMonitoringRtmpRef.current = false;
        console.log(' Monitoreo RTMP detenido');
    };

    // ================== HLS CLEANUP HELPER ==================
    const cleanupHLS = () => {
        console.log('Limpiando estado HLS completamente');
        stopPlaybackHealthMonitor();

        // NUEVO: Resetear flags de control
        hlsInitializingRef.current = false;
        hlsReadyRef.current = false;

        if (rtmpHlsRef.current) {
            try {
                rtmpHlsRef.current.destroy();
            } catch (e) {
                console.log(' Error destruyendo HLS:', e);
            }
            rtmpHlsRef.current = null;
        }

        // Reset video element
        const rtmpVideo = rtmpVideoRef.current;
        if (rtmpVideo) {
            rtmpVideo.pause();
            rtmpVideo.src = '';
            rtmpVideo.load();
        }
    };

    // ================== PLAYBACK HEALTH MONITOR ==================
    const startPlaybackHealthMonitor = () => {
        stopPlaybackHealthMonitor();
        lastTimeRef.current = 0;
        stagnantCounterRef.current = 0;
        playbackHealthIntervalRef.current = setInterval(() => {
            const video = rtmpVideoRef.current;
            if (!video || !showingRtmp) return;

            const now = performance.now();
            const currentTime = video.currentTime;
            const readyState = video.readyState; // 0-4 (HAVE_NOTHING .. HAVE_ENOUGH_DATA)

            // Detect stagnant playback (time not advancing)
            if (!video.paused && Math.abs(currentTime - lastTimeRef.current) < 0.15) {
                stagnantCounterRef.current += 1;
            } else {
                stagnantCounterRef.current = 0;
            }
            lastTimeRef.current = currentTime;

            // Compute buffer ahead
            let bufferAhead = 0;
            try {
                const buf = video.buffered;
                for (let i = 0; i < buf.length; i++) {
                    if (currentTime >= buf.start(i) && currentTime <= buf.end(i)) {
                        bufferAhead = buf.end(i) - currentTime;
                        break;
                    }
                }
            } catch { }

            // Live edge distance
            let liveEdgeGap = 0;
            if (video.seekable && video.seekable.length > 0) {
                const liveEdge = video.seekable.end(video.seekable.length - 1);
                liveEdgeGap = liveEdge - currentTime;
            }

            // Log occasionally (every 5s)
            if (now - lastBufferLogRef.current > 5000) {
                lastBufferLogRef.current = now;
                console.log('⏱️ Health', { ct: currentTime.toFixed(2), bufferAhead: bufferAhead.toFixed(2), liveGap: liveEdgeGap.toFixed(2), readyState, stagnant: stagnantCounterRef.current });
            }

            const hls = rtmpHlsRef.current as any;

            // Recovery strategies - STRICT LIVE EDGE
            const tooFarBehind = liveEdgeGap > 5; //  STRICT: > 5s is too far
            const lowBuffer = bufferAhead < 0.5;   //  STRICT: < 0.5s is critical
            const stagnant = stagnantCounterRef.current >= 3; //  STRICT: 3s stagnant is too long

            if ((tooFarBehind || (lowBuffer && !video.paused) || stagnant) && now - lastStallRecoveryRef.current > 3000) {
                lastStallRecoveryRef.current = now;
                console.warn(' Playback degradation detected (Strict Mode)', { tooFarBehind, lowBuffer, stagnant, readyState });

                try {
                    //  STRICT: Jump immediately to live edge
                    if (video.seekable && video.seekable.length > 0 && (tooFarBehind || stagnant)) {
                        const edge = video.seekable.end(video.seekable.length - 1) - 1.0; //  Target 1s from edge
                        console.log('⚡ Jumping to live edge (Strict Mode)', edge);
                        video.currentTime = edge;
                    }

                    //  STRICT: Only play if paused, NEVER force reload manually
                    if (video.paused) {
                        video.play().catch(() => { });
                    }

                    // Removed aggressive hls.startLoad() to prevent request spam
                } catch (e) {
                    console.log(' Error during strict recovery', e);
                }
            }
        }, 1000); // check every second
    };

    const stopPlaybackHealthMonitor = () => {
        if (playbackHealthIntervalRef.current) {
            clearInterval(playbackHealthIntervalRef.current);
            playbackHealthIntervalRef.current = null;
        }
    };

    // HLS.js ya está disponible como import directo - no necesita CDN
    useEffect(() => {
        console.log('HLS.js cargado como módulo de Node.js:', Hls.isSupported());
    }, []);

    // Initialize component
    useEffect(() => {
        console.log('Inicializando viewer para:', STREAM_KEY);

        // NUEVO: Iniciar en estado de espera por defecto
        setIsWaitingForStream(true);
        setWaitingMessage('Conectando al stream...');

        enableAutoAudio();
        setupEventListeners();
        connectSocket();
        startHeartbeat();
        startRtmpMonitoring(); // NUEVO: Iniciar monitoreo RTMP

        // NUEVO: Verificación periódica de estado para evitar pantallas negras
        const stateCheckInterval = setInterval(() => {
            if (socketRef.current?.connected && isWaitingForStream) {
                console.log(' Verificación periódica de estado - Cliente esperando...');
                socketRef.current.emit('force_state_check', { streamKey: STREAM_KEY });
            }
        }, 10000); // Cada 10 segundos

        // MEJORADO: Mecanismo de respaldo más inteligente
        const videoRequestInterval = setInterval(() => {
            if (socketRef.current?.connected) {
                if (videosList.length === 0 && !isRtmpAvailable) {
                    console.log(' Solicitando videos (sin videos locales y sin RTMP)');
                    socketRef.current.emit('request_videos_list', { streamKey: STREAM_KEY });
                }

                //  NUEVO: Forzar verificación si llevamos mucho tiempo esperando
                if (isWaitingForStream) {
                    console.log('Forzando verificación por tiempo de espera prolongado');
                    socketRef.current.emit('force_state_check', { streamKey: STREAM_KEY });
                }
            }
        }, 8000); // Cada 8 segundos

        return () => {
            clearInterval(videoRequestInterval);
            clearInterval(stateCheckInterval);
            stopRtmpMonitoring(); // NUEVO: Detener monitoreo RTMP
            cleanup();
        };
    }, []);

    const startHeartbeat = () => {
        // Enviar heartbeat cada 30 segundos
        heartbeatIntervalRef.current = setInterval(() => {
            if (socketRef.current && socketRef.current.connected) {
                socketRef.current.emit('heartbeat');
            }
        }, 30000);
    };

    // Setup RTMP stream when HLS is available and RTMP status changes
    useEffect(() => {
        if (Hls.isSupported() && isRtmpAvailable) {
            setupRtmpStream();
        }
    }, [isRtmpAvailable]);

    // Start local video when videos list changes
    useEffect(() => {
        if (videosList.length > 0) {
            console.log(' Lista de videos actualizada, verificando si se debe iniciar reproducción');

            // Solo iniciar video si no estamos mostrando RTMP y no hay video reproduciéndose
            if (!showingRtmp && !isWaitingForStream) {
                const localVideo = localVideoRef.current;
                const needsVideo = !localVideo ||
                    localVideo.paused ||
                    !localVideo.src ||
                    localVideo.src === '' ||
                    localVideo.ended;

                if (needsVideo) {
                    console.log(' No hay video reproduciéndose, iniciando videos locales');
                    startLocalVideo();
                } else {
                    console.log(' Ya hay video reproduciéndose, no interrumpiendo');
                }
            } else if (showingRtmp) {
                console.log(' RTMP activo, no iniciando videos locales');
            } else if (isWaitingForStream) {
                console.log(' En pantalla de espera, no iniciando videos locales');
            }
        } else {
            console.log(' Lista de videos vacía');
        }
    }, [videosList, showingRtmp, isWaitingForStream]);

    const enableAutoAudio = () => {
        console.log(' Activando audio automáticamente para OBS');
        setAudioEnabled(true);
        setUserHasInteracted(true);

        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            if (audioContext.state === 'suspended') {
                audioContext.resume().then(() => {
                    console.log('🎵 Contexto de audio activado');
                });
            }
        } catch (error) {
            console.log(' No se pudo crear contexto de audio:', error);
        }
    };

    const setupEventListeners = () => {
        // Will be set up in useEffect for each video element
    };

    const connectSocket = () => {
        socketRef.current = io(SOCKET_URL, {
            transports: ['polling', 'websocket'], // Comenzar con polling, luego websocket
            forceNew: true, // Forzar nueva conexión
            timeout: 20000, // Timeout de conexión
            reconnection: true, // Habilitar reconexión automática
            reconnectionAttempts: 5, // Intentos de reconexión
            reconnectionDelay: 1000, // Delay entre intentos
            withCredentials: true // Incluir credentials
        });

        socketRef.current.on('connect', () => {
            console.log('🔌 Socket conectado');
            socketRef.current?.emit('join', STREAM_KEY);

            //  NUEVO: Solicitar lista de videos inmediatamente al conectar
            setTimeout(() => {
                if (videosList.length === 0) {
                    console.log(' No hay videos cargados, solicitando lista al servidor');
                    socketRef.current?.emit('request_videos_list', { streamKey: STREAM_KEY });
                }
            }, 1000);
        });

        socketRef.current.on('connect_error', (error) => {
            console.error(' Error de conexión Socket.IO:', error);
            setIsWaitingForStream(true);
            setWaitingMessage('Error de conexión, reintentando...');
        });

        socketRef.current.on('disconnect', (reason) => {
            console.log('🔌 Socket desconectado, razón:', reason);
            setIsWaitingForStream(true);
            setWaitingMessage('Conexión perdida, reintentando...');
        });

        socketRef.current.on('reconnect', (attemptNumber) => {
            console.log(' Socket reconectado en intento:', attemptNumber);
            socketRef.current?.emit('join', STREAM_KEY);
        });

        socketRef.current.on('reconnect_error', (error) => {
            console.error(' Error de reconexión:', error);
            setWaitingMessage('Error de reconexión...');
        });

        // NUEVO: Escuchar cambios de estado RTMP
        socketRef.current.on('rtmp_status_change', (data: {
            streamKey: string;
            rtmpStatus: 'ACTIVE' | 'INACTIVE' | 'STOPPED';
            rtmpAvailable: boolean;
            deviceConnected: boolean;
            timestamp: string;
            message: string;
            action: string;
            fallbackActive?: boolean;
        }) => {
            console.log('Cambio de estado RTMP recibido:', data);

            if (data.streamKey === STREAM_KEY) {
                setRtmpStatusMonitor(data.rtmpStatus);

                switch (data.rtmpStatus) {
                    case 'ACTIVE':
                        console.log('RTMP ACTIVO:', data.message);
                        setIsWaitingForStream(false);
                        handleRtmpStatusChange(true);
                        break;

                    case 'INACTIVE':
                        console.log('RTMP INACTIVO:', data.message);
                        handleRtmpStatusChange(false);
                        break;

                    case 'STOPPED':
                        console.log('STREAM FINALIZADO:', data.message);
                        setIsWaitingForStream(true);
                        setWaitingMessage('Stream finalizado');
                        handleRtmpStatusChange(false);
                        break;
                }
            }
        });

        // NUEVO: Escuchar cuando el stream está activo
        socketRef.current.on('streamActive', (data: {
            streamActive: boolean;
            deviceConnected: boolean;
            rtmpAvailable: boolean;
            videosList: string[]
        }) => {
            console.log('Stream activo recibido:', data);
            console.log('Estado previo:', { isWaitingForStream, showingRtmp, isRtmpAvailable });

            // El stream está activo, ocultar pantalla de espera y mostrar contenido
            setIsWaitingForStream(false);
            console.log(' Pantalla de espera OCULTADA por streamActive');

            if (data.videosList && data.videosList.length > 0) {
                setVideosList(data.videosList);
                console.log('Videos del stream activo:', data.videosList);

                //  NUEVO: Si no hay RTMP, iniciar videos locales inmediatamente
                if (!data.rtmpAvailable) {
                    console.log('No hay RTMP activo, iniciando videos locales inmediatamente');
                    setTimeout(() => {
                        const localVideo = localVideoRef.current;
                        if (!localVideo || localVideo.paused || !localVideo.src) {
                            startLocalVideo();
                        }
                    }, 500);
                }
            }

            // Manejar estado de RTMP DESPUÉS de ocultar pantalla de espera
            setTimeout(() => {
                handleRtmpStatusChange(data.rtmpAvailable, data.videosList);
            }, 100);
        });

        socketRef.current.on('deviceStatusChange', (data: { rtmpAvailable: boolean; videosList: string[] }) => {
            console.log('Cambio de dispositivo RTMP:', data);
            // Solo manejar cambios de RTMP, no de stream completo
            handleRtmpStatusChange(data.rtmpAvailable, data.videosList);
        });

        socketRef.current.on('disconnect', () => {
            console.log('Socket desconectado - Mostrando pantalla de espera...');
            //  CAMBIO: Mostrar pantalla de espera en lugar de reload inmediato
            setIsWaitingForStream(true);
            setWaitingMessage('Conexión perdida, reintentando...');

            // Recargar después de un tiempo si no se reconecta
            setTimeout(() => {
                if (!socketRef.current?.connected) {
                    window.location.reload();
                }
            }, 10000); // 10 segundos
        });

        // NUEVO: Escuchar eventos de clientes huérfanos
        socketRef.current.on('waitingForStream', (data: { streamKey: string; message: string; status: string }) => {
            console.log('Esperando stream recibido:', data);
            console.log('Estado actual antes de waitingForStream:', {
                isWaitingForStream,
                showingRtmp,
                isRtmpAvailable
            });

            setIsWaitingForStream(true);
            setWaitingMessage(data.message);

            // NUEVO: Limpiar HLS y parar videos cuando volvemos a espera
            cleanupHLS();
            setIsRtmpAvailable(false);
            setShowingRtmp(false);

            // Pausar video local
            const localVideo = localVideoRef.current;
            if (localVideo) {
                localVideo.pause();
                console.log('Video local pausado por waitingForStream');
            }

            //  NUEVO: Solicitar videos mientras esperamos
            setTimeout(() => {
                if (socketRef.current?.connected) {
                    console.log('Solicitando videos mientras esperamos stream');
                    socketRef.current.emit('request_videos_list', { streamKey: STREAM_KEY });
                }
            }, 2000);

            console.log('Pantalla de espera activada por waitingForStream');
        });

        // NUEVO: Escuchar cuando el stream inicia
        socketRef.current.on('streamStarted', (data: { streamKey: string; message: string; action: string }) => {
            console.log('Stream iniciado:', data);
            //  CAMBIO: No recargar automáticamente, dejar que streamActive maneje el estado
            setIsWaitingForStream(false);
            setWaitingMessage('Stream iniciado...');
        });

        // NUEVO: Escuchar cuando el stream se detiene
        socketRef.current.on('streamStopped', (data: { streamKey: string; message: string; action: string }) => {
            console.log('Stream detenido recibido:', data);
            console.log('Estado actual:', {
                isWaitingForStream,
                showingRtmp,
                isRtmpAvailable,
                videoListLength: videosList.length
            });

            // MEJORADO: Mostrar pantalla de espera en lugar de recargar
            setIsWaitingForStream(true);
            setWaitingMessage(data.message || 'Stream detenido, esperando reconexión...');

            // Limpiar todo el estado del stream
            cleanupHLS();
            setIsRtmpAvailable(false);
            setShowingRtmp(false);

            //  NUEVO: Pausar video local también
            const localVideo = localVideoRef.current;
            if (localVideo) {
                localVideo.pause();
                console.log('Video local pausado por detención de stream');
            }

            console.log('Pantalla de espera activada por stream detenido');
        });

        // NUEVO: Escuchar respuesta de lista de videos solicitada
        socketRef.current.on('videos_list_response', (data: { streamKey: string; videosList: string[] }) => {
            console.log('Lista de videos recibida:', data);
            if (data.videosList && data.videosList.length > 0) {
                setVideosList(data.videosList);

                //  MEJORADO: Si no estamos mostrando RTMP y no hay video reproduciéndose, iniciar videos locales
                if (!showingRtmp && !isWaitingForStream) {
                    const localVideo = localVideoRef.current;
                    const needsToStartVideo = !localVideo ||
                        localVideo.paused ||
                        !localVideo.src ||
                        localVideo.src === '';

                    if (needsToStartVideo) {
                        console.log('Iniciando videos locales con nueva lista recibida');
                        setTimeout(() => startLocalVideo(), 500);
                    } else {
                        console.log('Ya hay un video reproduciéndose, no iniciando nuevo');
                    }
                }
            }
        });

        // NUEVO: Manejar forzar reproducción local
        socketRef.current.on('forceLocalPlayback', (data: { streamKey: string; videosList: string[]; reason: string }) => {
            console.log('Forzando reproducción local:', data);

            if (data.streamKey === STREAM_KEY && data.videosList && data.videosList.length > 0) {
                setVideosList(data.videosList);
                setIsWaitingForStream(false);
                setShowingRtmp(false);
                setIsRtmpAvailable(false);

                console.log('Forzando inicio de videos locales por:', data.reason);
                setTimeout(() => {
                    startLocalVideo();
                }, 100);
            }
        });

        // NUEVO: Escuchar cuando el stream se inicia/reinicia
        socketRef.current.on('streamStarted', (data: { streamKey: string; message: string; action: string }) => {
            console.log('Stream iniciado/reiniciado recibido:', data);
            console.log(' Estado actual antes de streamStarted:', {
                isWaitingForStream,
                showingRtmp,
                isRtmpAvailable
            });

            //  IMPORTANTE: Solo ocultar pantalla de espera si corresponde al streamKey actual
            if (data.streamKey === STREAM_KEY) {
                setIsWaitingForStream(false);
                setWaitingMessage('Stream iniciado, conectando...');

                console.log('Pantalla de espera desactivada por stream iniciado');

                //  NUEVO: Solicitar estado actual del stream
                setTimeout(() => {
                    if (socketRef.current?.connected) {
                        console.log('Solicitando estado actual del stream tras reinicio');
                        socketRef.current.emit('join', STREAM_KEY);
                    }
                }, 500);
            } else {
                console.log('streamStarted para streamKey diferente, ignorando');
            }
        });

        // NUEVO: Debug - Exponer función de estado en window para debugging
        if (typeof window !== 'undefined') {
            (window as any).debugStreamState = () => {
                console.log('ESTADO ACTUAL DEL STREAM:', {
                    isWaitingForStream,
                    showingRtmp,
                    isRtmpAvailable,
                    videosList: videosList.length,
                    userHasInteracted,
                    audioEnabled,
                    rtmpStatus: rtmpStatus.text,
                    localStatus: localStatus.text,
                    socketConnected: socketRef.current?.connected || false
                });

                const localVideo = localVideoRef.current;
                const rtmpVideo = rtmpVideoRef.current;

                console.log('ESTADO DE VIDEOS:', {
                    localVideo: {
                        exists: !!localVideo,
                        src: localVideo?.src || 'none',
                        paused: localVideo?.paused,
                        muted: localVideo?.muted,
                        volume: localVideo?.volume,
                        currentTime: localVideo?.currentTime,
                        duration: localVideo?.duration
                    },
                    rtmpVideo: {
                        exists: !!rtmpVideo,
                        src: rtmpVideo?.src || 'none',
                        paused: rtmpVideo?.paused,
                        muted: rtmpVideo?.muted,
                        volume: rtmpVideo?.volume,
                        currentTime: rtmpVideo?.currentTime
                    }
                });
            };
        }

        // ========== OBS WEBSOCKET INTEGRATION ==========
        // Registrar este cliente como cliente OBS
        socketRef.current.emit('register_obs_client', {
            streamKey: STREAM_KEY,
            clientInfo: {
                userAgent: navigator.userAgent,
                timestamp: new Date().toISOString()
            }
        });

        // Escuchar confirmación de registro OBS
        socketRef.current.on('obs_client_registered', (data: { success: boolean; clientId: string; streamKey: string }) => {
            console.log('Cliente OBS registrado:', data);
        });

        // Escuchar comandos OBS del servidor
        socketRef.current.on('obs_command', (data: any) => {
            console.log('Comando OBS recibido:', data);
            handleObsCommand(data);
        });
    };

    // ========== OBS WEBSOCKET FUNCTIONS ==========
    let obsWS: any = null;

    // Variables para controlar el estado OBS
    const [obsConnectionStatus, setObsConnectionStatus] = useState<string>('disconnected');
    const [isObsStreaming, setIsObsStreaming] = useState<boolean>(false);
    const [currentObsScene, setCurrentObsScene] = useState<string>('');
    const [obsScenes, setObsScenes] = useState<string[]>([]);

    // Función para manejar comandos OBS del servidor
    const handleObsCommand = async (data: any) => {
        console.log('📥 [OBS] Comando recibido:', data);
        switch (data.type) {
            case 'execute_obs_action':
                await executeObsAction(data.action, data.params);
                break;

            case 'execute_obs_action_with_response':
                await executeObsActionWithResponse(data.action, data.params, data.requestId);
                break;

            case 'request_obs_status':
                await sendCurrentObsStatus();
                break;

            case 'connect_to_obs':
                console.log(` Credenciales recibidas: ${data.credentials.address}`);
                await connectToOBSWithCredentials(data.credentials.address, data.credentials.password);
                break;
        }
    };

    // Función para conectar a OBS WebSocket
    const connectToOBSWithCredentials = async (address: string, password: string) => {
        console.log(`🔌 [OBS] Intentando conectar a: ${address}`);
        if (obsWS) {
            console.log('🔌 [OBS] Desconectando sesión anterior...');
            await obsWS.disconnect();
        }

        updateObsStatus('Conectando...', 'connecting');

        try {
            // Usar la biblioteca obs-websocket-js importada
            obsWS = new OBSWebSocket();
            await obsWS.connect(`ws://${address}`, password);

            updateObsStatus('Conectado', 'connected');
            console.log(`✅ [OBS] Conectado exitosamente a: ${address}`);

            setupObsEvents();
            await getInitialObsStatus();

            // Notificar al servidor
            sendObsStatusToServer({
                connection_status: 'connected',
                address: address,
                timestamp: new Date().toISOString()
            });

        } catch (error: any) {
            updateObsStatus('Error de conexión', 'error');
            console.error(`❌ [OBS] Error fatal conectando a OBS: ${error.message}`, error);

            // Notificar al servidor del error
            sendObsStatusToServer({
                connection_status: 'error',
                error: error.message,
                address: address,
                timestamp: new Date().toISOString()
            });
        }
    };

    const setupObsEvents = () => {
        if (!obsWS) return;
        console.log('🎧 [OBS] Configurando listeners de eventos');

        obsWS.on('StreamStateChanged', (data: any) => {
            console.log(`📡 [OBS] Cambio estado Stream: ${data.outputState}`, data);
            const isStreaming = data.outputActive;
            setIsObsStreaming(isStreaming);
            sendObsStatusToServer({
                event: 'stream_state_changed',
                data: data,
                isStreaming: isStreaming
            });
        });

        obsWS.on('RecordStateChanged', (data: any) => {
            console.log(`⏺️ [OBS] Cambio estado Grabación: ${data.outputState}`, data);
            sendObsStatusToServer({
                event: 'record_state_changed',
                data: data
            });
        });

        obsWS.on('CurrentProgramSceneChanged', (data: any) => {
            console.log(`🎬 [OBS] Cambio de Escena: ${data.sceneName}`, data);
            setCurrentObsScene(data.sceneName);
            sendObsStatusToServer({
                event: 'scene_changed',
                data: data,
                currentScene: data.sceneName
            });
        });
    };

    const updateObsStatus = (status: string, connectionStatus: string) => {
        setObsConnectionStatus(connectionStatus);
        console.log(` OBS Status: ${status} (${connectionStatus})`);
    };

    const sendObsStatusToServer = (status: any) => {
        if (socketRef.current) {
            socketRef.current.emit('obs_status_update', { status });
        }
    };

    // Ejecutar acción OBS con respuesta
    const executeObsActionWithResponse = async (action: string, params = {}, requestId: string) => {
        console.log(`🚀 [OBS] Ejecutando acción con respuesta: ${action}`, params);
        if (!obsWS) {
            const errorResponse = {
                requestId: requestId,
                success: false,
                error: 'No conectado a OBS',
                obsData: null
            };
            socketRef.current?.emit('obs_response', errorResponse);
            console.warn('⚠️ [OBS] No conectado, no se puede ejecutar:', action);
            return;
        }

        try {
            const result = await obsWS.call(action, params);
            console.log(`✅ [OBS] Acción ejecutada exitosamente: ${action}`, result);

            const successResponse = {
                requestId: requestId,
                success: true,
                error: null,
                obsData: result,
                executedAction: action,
                executedParams: params
            };
            socketRef.current?.emit('obs_response', successResponse);

            // Actualizar estado después de la acción
            if (action.includes('Stream') || action.includes('Record')) {
                setTimeout(getInitialObsStatus, 1000);
            }

        } catch (error: any) {
            console.error(` Error ejecutando ${action}: ${error.message}`);

            const errorResponse = {
                requestId: requestId,
                success: false,
                error: error.message,
                obsData: null,
                executedAction: action,
                executedParams: params
            };
            socketRef.current?.emit('obs_response', errorResponse);
        }
    };

    // Ejecutar acción OBS simple
    const executeObsAction = async (action: string, params = {}) => {
        console.log(`🚀 [OBS] Ejecutando acción simple: ${action}`, params);
        if (!obsWS) {
            console.warn('⚠️ [OBS] No conectado, no se puede ejecutar:', action);
            return;
        }

        try {
            const result = await obsWS.call(action, params);
            console.log(`✅ [OBS] Acción simple ejecutada: ${action}`, result);

            // Actualizar estado después de la acción
            if (action.includes('Stream') || action.includes('Record')) {
                setTimeout(getInitialObsStatus, 1000);
            }

            sendObsStatusToServer({
                action_executed: action,
                result: result,
                timestamp: new Date().toISOString()
            });

        } catch (error: any) {
            console.error(` Error ejecutando ${action}: ${error.message}`);
        }
    };

    const getInitialObsStatus = async () => {
        if (!obsWS) return;
        console.log('🔄 [OBS] Obteniendo estado inicial completo...');

        try {
            const [streamStatus, recordStatus, currentScene, sceneList] = await Promise.all([
                obsWS.call('GetStreamStatus'),
                obsWS.call('GetRecordStatus'),
                obsWS.call('GetCurrentProgramScene'),
                obsWS.call('GetSceneList')
            ]);

            console.log('📊 [OBS] Estado obtenido:', {
                stream: streamStatus.outputActive,
                record: recordStatus.outputActive,
                scene: currentScene.currentProgramSceneName,
                scenesCount: sceneList.scenes.length
            });

            const status = {
                stream: streamStatus,
                record: recordStatus,
                currentScene: currentScene,
                scenes: sceneList.scenes,
                isStreaming: streamStatus.outputActive,
                currentSceneName: currentScene.currentProgramSceneName
            };

            setIsObsStreaming(streamStatus.outputActive);
            setCurrentObsScene(currentScene.currentProgramSceneName);
            setObsScenes(sceneList.scenes.map((scene: any) => scene.sceneName));

            sendObsStatusToServer(status);

        } catch (error: any) {
            console.error(` Error obteniendo estado: ${error.message}`);
        }
    };

    const sendCurrentObsStatus = async () => {
        await getInitialObsStatus();
    };

    //  NUEVO: Función crítica para manejar cambios en el estado RTMP
    const handleRtmpStatusChange = (rtmpAvailable: boolean, videosList?: string[]) => {
        console.log(' Manejando cambio de estado RTMP:', { rtmpAvailable, videosListLength: videosList?.length || 0 });
        console.log(' Estado antes del cambio:', {
            isRtmpAvailable,
            showingRtmp,
            isWaitingForStream,
            hlsInitializing: hlsInitializingRef.current,
            hlsReady: hlsReadyRef.current
        });

        const wasAvailable = isRtmpAvailable;
        setIsRtmpAvailable(rtmpAvailable);

        if (videosList && videosList.length > 0) {
            setVideosList(videosList);
            console.log(' Videos actualizados:', videosList.length);
        }

        //  IMPORTANTE: Si estamos en pantalla de espera, solo ignorar si NO hay RTMP
        //  Si RTMP está activo, forzamos salir del estado de espera y procesamos el cambio.
        if (isWaitingForStream && !rtmpAvailable) {
            console.log(' En pantalla de espera y RTMP no disponible, ignorando cambios');
            return;
        } else if (isWaitingForStream && rtmpAvailable) {
            console.log(' En pantalla de espera pero RTMP activo — forzando salida de espera');
            setIsWaitingForStream(false);
        }

        if (rtmpAvailable && !wasAvailable) {
            console.log(' Dispositivo RTMP conectado - PREPARANDO CAMBIO DIRECTO');
            console.log(' FORZANDO MUTEO PERMANENTE de videos locales por nueva conexión RTMP');

            forceLocalVideoMute();
            startForcedMuteMonitor();

            setRtmpStatus({ text: 'Conectando...', active: true });

            //  SIMPLIFICADO: Configurar HLS y cambiar directamente
            if (Hls.isSupported()) {
                console.log(' Configurando stream RTMP inmediatamente');
                setupRtmpStream();

                // Forzar el cambio a RTMP (asegura que no dependa del state async)
                setTimeout(() => {
                    try {
                        // Llamamos a la función que centraliza el cambio
                        (switchToRtmp as any)(true);
                    } catch (e) {
                        console.warn(' Error forzando switchToRtmp:', e);
                    }
                }, 200);
            }
        } else if (rtmpAvailable) {
            console.log(' RTMP ya disponible - FORZANDO CAMBIO INMEDIATO');
            setRtmpStatus({ text: 'Conectado', active: true });
            forceLocalVideoMute();
            startForcedMuteMonitor();
            console.log(' Videos locales FORZOSAMENTE muteados - RTMP activo');

            // Forzar cambio inmediato usando la función centralizada
            try {
                (switchToRtmp as any)(true);
            } catch (e) {
                console.warn(' Error al forzar switchToRtmp:', e);
            }

        } else {
            // RTMP inactivo: por política NO consultamos el .m3u8
            console.log(' RTMP marcado como inactivo — no se consultará el .m3u8 por política');

            // Limpiar HLS y detener monitores relacionados
            console.log(' Limpiando estado HLS y deteniendo monitores');
            cleanupHLS();
            stopForcedMuteMonitor();
            setRtmpStatus({ text: 'Desconectado', active: false });

            // Cambiar a videos locales si procede
            if (!isWaitingForStream) {
                setTimeout(() => {
                    if (videosList && videosList.length > 0) {
                        console.log(' Cambiando a videos locales tras desconexión RTMP');
                        switchToLocal();
                    } else {
                        console.log(' No hay videos locales disponibles, solicitando al servidor');
                        if (socketRef.current?.connected) {
                            socketRef.current.emit('request_videos_list', { streamKey: STREAM_KEY });
                        }
                    }
                }, 1000);
            }
        }
    };

    const forceLocalVideoMute = () => {
        const localVideo = localVideoRef.current;
        if (localVideo) {
            localVideo.muted = true;
            localVideo.volume = 0;
            console.log(' MUTEO FORZADO aplicado a video local (muted=true, volume=0)');
        }
    };

    const startForcedMuteMonitor = () => {
        stopForcedMuteMonitor();

        console.log(' Iniciando monitor de muteo forzado para videos locales');
        forcedMuteIntervalRef.current = setInterval(() => {
            const localVideo = localVideoRef.current;
            const rtmpVideo = rtmpVideoRef.current;

            if (isRtmpAvailable && localVideo) {
                if (!localVideo.muted || localVideo.volume > 0) {
                    console.log(' DETECTADO: Video local intentó activar audio durante RTMP - FORZANDO MUTEO');
                    forceLocalVideoMute();
                }

                if (showingRtmp && rtmpVideo && rtmpVideo.muted && audioEnabled) {
                    console.log(' Reactivando audio RTMP que fue muteado accidentalmente');
                    rtmpVideo.muted = false;
                }
            }
        }, 500);
    };

    const stopForcedMuteMonitor = () => {
        if (forcedMuteIntervalRef.current) {
            clearInterval(forcedMuteIntervalRef.current);
            forcedMuteIntervalRef.current = null;
            console.log(' Monitor de muteo forzado detenido');
        }
    };

    const waitForHLSAvailability = (callback: () => void) => {
        const maxWait = 15000; // 15 segundos máximo (arranque más rápido)
        const checkInterval = 500; // Verificar cada 500ms para detectar más rápido
        let elapsed = 0;
        let consecutiveSuccesses = 0;

        // Abort previous polling if exists
        try {
            if (hlsCheckAbortRef.current) {
                hlsCheckAbortRef.current.abort();
                hlsCheckAbortRef.current = null;
            }
        } catch (e) {
            console.warn(' Error aborting previous HLS check controller', e);
        }

        const controller = new AbortController();
        hlsCheckAbortRef.current = controller;

        const checkHLS = async () => {
            // If this polling was cancelled or HLS is already initializing, stop
            if (hlsCheckAbortRef.current !== controller) {
                console.log(' HLS availability check cancelled (stale controller)');
                return;
            }

            if (!isRtmpAvailable) {
                console.log(' RTMP no disponible mientras se espera HLS — abortando chequeo');
                return;
            }

            if (hlsInitializingRef.current) {
                console.log(' HLS ya se está inicializando — deteniendo polling de disponibilidad');
                return;
            }

            try {
                const hlsUrl = `${HLS_BASE_URL}/hls/${STREAM_KEY}.m3u8`;
                console.log(` Verificando HLS: ${hlsUrl}`);

                const response = await fetch(hlsUrl, {
                    method: 'GET',
                    cache: 'no-store',
                    signal: controller.signal
                });

                if (response.ok) {
                    const content = await response.text();
                    const segmentMatches = content.match(/\.ts/g);
                    const hasValidPlaylist = content.includes('#EXTM3U');
                    const segmentCount = segmentMatches ? segmentMatches.length : 0;

                    console.log(` HLS Check: Playlist válida: ${hasValidPlaylist}, Segmentos: ${segmentCount}`);

                    // If we have at least one segment, consider it sufficient to start
                    if (hasValidPlaylist && segmentCount >= 1) {
                        consecutiveSuccesses++;
                        console.log(` HLS válido (${consecutiveSuccesses}/1) con ${segmentCount} segmentos`);

                        if (consecutiveSuccesses >= 1) {
                            // Clear controller for this polling run
                            if (hlsCheckAbortRef.current === controller) hlsCheckAbortRef.current = null;
                            console.log(' HLS confirmado y listo');
                            callback();
                            return;
                        }
                    } else {
                        consecutiveSuccesses = 0;
                    }
                } else {
                    consecutiveSuccesses = 0;
                    console.warn(` HLS HTTP ${response.status}: ${response.statusText}`);
                }
            } catch (error: any) {
                if (error.name === 'AbortError') {
                    console.log(' HLS availability fetch aborted');
                    return;
                }
                consecutiveSuccesses = 0;
                console.warn(' Error verificando HLS:', error.message || error);
            }

            elapsed += checkInterval;
            if (elapsed < maxWait && hlsCheckAbortRef.current === controller && isRtmpAvailable && !hlsInitializingRef.current) {
                setTimeout(checkHLS, checkInterval);
            } else {
                if (hlsCheckAbortRef.current === controller) hlsCheckAbortRef.current = null;
                console.warn(` Timeout esperando HLS después de ${elapsed}ms. Llamando callback por fallback.`);
                callback();
            }
        };

        setTimeout(checkHLS, checkInterval);
    };

    const setupRtmpStream = () => {
        const streamUrl = `${HLS_BASE_URL}/hls/${STREAM_KEY}.m3u8`;
        const rtmpVideo = rtmpVideoRef.current;

        console.log(' Configurando stream RTMP optimizado:', streamUrl);
        console.log(' Elemento de video RTMP:', rtmpVideo ? 'Disponible' : 'No disponible');
        console.log('🔧 HLS.js:', Hls.isSupported() ? 'Soportado' : 'No soportado');

        if (!rtmpVideo || !Hls.isSupported()) {
            console.error(' No se puede configurar RTMP: elementos faltantes');
            return;
        }

        //  NUEVO: Evitar inicialización múltiple simultánea
        if (hlsInitializingRef.current) {
            console.log(' HLS ya se está inicializando, esperando...');
            return;
        }

        //  NUEVO: Si ya tenemos una instancia funcionando, no recrear
        if (rtmpHlsRef.current && hlsReadyRef.current) {
            console.log(' HLS ya está configurado y funcionando');
            return;
        }

        // Limpiar instancia anterior solo si es necesario
        if (rtmpHlsRef.current) {
            console.log(' Limpiando instancia HLS anterior');
            try {
                rtmpHlsRef.current.destroy();
            } catch (error) {
                console.warn(' Error limpiando HLS anterior:', error);
            }
            rtmpHlsRef.current = null;
        }

        //  MEJORADO: Resetear video sin operaciones innecesarias
        if (rtmpVideo.src !== '') {
            rtmpVideo.removeAttribute('src');
            rtmpVideo.load();
        }

        if (Hls.isSupported()) {
            console.log(' Esperando playlist HLS antes de inicializar HLS.js (evitar 404s)');

            // Esperar a que el playlist tenga al menos 2 segmentos estables
            waitForHLSAvailability(() => {
                if (!isRtmpAvailable) {
                    console.warn(' RTMP ya no disponible al intentar inicializar HLS');
                    return;
                }

                if (hlsInitializingRef.current) {
                    console.log(' HLS ya está siendo inicializado por otro proceso');
                    return;
                }

                console.log(' Inicializando HLS.js con configuración optimizada');

                //  STRICT LIVE EDGE MODE: Configurada para fragmentos ~2s y playlist ~10s
                const hlsConfig = {
                    debug: HLS_DEBUG,
                    enableWorker: true,
                    lowLatencyMode: false,
                    // Buffers CONSERVADORES para ventana de 20s
                    backBufferLength: 8,   // No pedir segmentos muy viejos (evitar 404 por cleanup)
                    maxBufferLength: 10,   // Buffer de 10s (la mitad de la ventana de 20s)
                    maxMaxBufferLength: 12, // Máximo 12s
                    startLevel: -1,
                    capLevelToPlayerSize: true,
                    testBandwidth: false,
                    abrEwmaDefaultEstimate: 5000000,
                    // Timeouts muy largos para conexiones lentas
                    manifestLoadingTimeOut: 20000,
                    manifestLoadingMaxRetry: 10,
                    manifestLoadingRetryDelay: 1500,
                    levelLoadingTimeOut: 20000,
                    levelLoadingMaxRetry: 8,
                    levelLoadingRetryDelay: 1500,
                    fragLoadingTimeOut: 25000,  // 25s timeout para segmentos muy lentos
                    fragLoadingMaxRetry: 10,
                    fragLoadingRetryDelay: 1500,
                    // CRÍTICO: Mantenerse en el CENTRO de la ventana de 20s
                    // Ajustado para fragmentos de ~2s y playlist de ~10s
                    // liveSyncDurationCount: cuántos fragmentos atrás iniciar (3*2s=6s)
                    liveSyncDurationCount: 3,
                    // liveMaxLatencyDurationCount: tolerancia antes de forzar salto (6*2s=12s)
                    liveMaxLatencyDurationCount: 6,
                    liveDurationInfinity: false,
                    maxLiveSyncPlaybackRate: 1.1, // Catch-up muy suave para evitar saltar al borde
                    minAutoBitrate: 0,
                    maxSeekHole: 3
                    ,
                    // Ensure XHRs don't include credentials and allow server to avoid preflight where possible
                    xhrSetup: (xhr: any, url: string) => {
                        try {
                            xhr.withCredentials = false;
                        } catch (e) {
                            // ignore
                        }
                    }
                };

                // Marcar inicio de inicialización
                hlsInitializingRef.current = true;
                hlsReadyRef.current = false;

                const hls = new Hls(hlsConfig);
                rtmpHlsRef.current = hls;

                //  MEJORADO: Event listeners optimizados
                hls.on(Hls.Events.MEDIA_ATTACHED, () => {
                    console.log(' HLS media attached correctamente');
                });

                hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
                    console.log('📋 HLS manifest parseado:', data.levels.length, 'niveles de calidad');
                    hlsInitializingRef.current = false;
                    hlsReadyRef.current = true;

                    // Intentar reproducir automáticamente
                    if (userHasInteracted && isRtmpAvailable) {
                        rtmpVideo.play().then(() => {
                            console.log(' HLS reproduciendo automáticamente');
                            startPlaybackHealthMonitor();
                        }).catch(error => {
                            console.warn(' No se pudo reproducir automáticamente:', error);
                        });
                    }
                });

                hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
                    console.log(` HLS cambió a nivel de calidad: ${data.level}`);
                });

                hls.on(Hls.Events.FRAG_LOADED, (event, data) => {
                    // Fragment cargado exitosamente
                    if (hlsInitializingRef.current) {
                        hlsInitializingRef.current = false;
                        hlsReadyRef.current = true;
                    }

                    // NUEVO: Monitor de ancho de banda
                    const loadTime = (data as any).stats.tload; // Tiempo de carga en ms
                    const duration = data.frag.duration * 1000; // Duración en ms

                    if (loadTime > duration * 0.9) {
                        console.warn(`⚠️ ANCHO DE BANDA BAJO: Segmento tardó ${loadTime.toFixed(0)}ms para ${duration.toFixed(0)}ms de video`);
                        setIsLowBandwidth(true);
                        // Auto-ocultar advertencia después de 5s si mejora
                        setTimeout(() => setIsLowBandwidth(false), 5000);
                    }
                });

                hls.on(Hls.Events.ERROR, (event, data) => {
                    console.error(' Error HLS:', data.type, data.details);

                    if (data.fatal) {
                        hlsInitializingRef.current = false;
                        hlsReadyRef.current = false;

                        switch (data.type) {
                            case Hls.ErrorTypes.NETWORK_ERROR:
                                console.log(' Error de red, intentando recuperar...');
                                hls.startLoad();
                                break;
                            case Hls.ErrorTypes.MEDIA_ERROR:
                                console.log(' Error de media, intentando recuperar...');
                                hls.recoverMediaError();
                                break;
                            default:
                                console.log('💥 Error fatal, recreando HLS...');
                                setTimeout(() => {
                                    if (isRtmpAvailable) {
                                        setupRtmpStream();
                                    }
                                }, 2000);
                                break;
                        }
                    }
                });

                // Configurar crossOrigin para evitar problemas de CORS/preflight y cargar stream
                try {
                    rtmpVideo.crossOrigin = 'anonymous';
                } catch (e) {
                    // ignore if not supported
                }

                // Configurar y cargar stream
                hls.loadSource(streamUrl);
                hls.attachMedia(rtmpVideo);
            });

        } else if (rtmpVideo.canPlayType('application/vnd.apple.mpegurl')) {
            console.log(' Usando reproducción HLS nativa (Safari)');
            rtmpVideo.src = streamUrl;
            hlsInitializingRef.current = false;
            hlsReadyRef.current = true;
        } else {
            console.error(' HLS no soportado en este navegador');
            hlsInitializingRef.current = false;
        }
    };


    const startLocalVideo = () => {
        if (videosList.length === 0) {
            console.log(' No hay videos disponibles para startLocalVideo');
            //  NUEVO: Solicitar videos si no hay ninguno
            if (socketRef.current && socketRef.current.connected) {
                console.log(' Solicitando lista de videos al servidor');
                socketRef.current.emit('request_videos_list', { streamKey: STREAM_KEY });
            }
            return;
        }

        //  NUEVO: Verificar si ya hay un video reproduciéndose antes de cambiar
        const localVideo = localVideoRef.current;
        if (localVideo && !localVideo.paused && localVideo.src && !localVideo.ended && localVideo.src !== '') {
            console.log(' Ya hay un video reproduciéndose, verificando si es válido...');

            // Verificar si el src actual está en la lista de videos válidos
            const currentUrl = localVideo.src;
            const isValidVideo = videosList.some(video => currentUrl.includes(video) || video.includes(currentUrl.split('/').pop() || ''));

            if (isValidVideo) {
                console.log(' Video actual es válido, no interrumpiendo');
                return;
            } else {
                console.log(' Video actual no es válido, cambiando a uno nuevo');
            }
        }

        //  NUEVO: Asegurar que no estamos en estado de espera
        if (isWaitingForStream) {
            console.log(' Aún en estado de espera, no iniciando video local');
            return;
        }

        const randomIndex = Math.floor(Math.random() * videosList.length);
        loadLocalVideo(randomIndex);
        console.log(' Rotación automática por tiempo DESHABILITADA - videos cambiarán solo al terminar');
    };

    const loadLocalVideo = (index: number) => {
        if (videosList.length === 0) return;

        index = index % videosList.length;
        setCurrentVideoIndex(index);

        const videoUrl = videosList[index];
        const videoName = videoUrl.split('/').pop();
        const localVideo = localVideoRef.current;

        if (!localVideo) return;

        console.log(' Reproduciendo video aleatorio [' + (index + 1) + '/' + videosList.length + ']:', videoName);

        localVideo.src = videoUrl;
        localVideo.load();

        if (isRtmpAvailable) {
            localVideo.muted = true;
            localVideo.volume = 0;
            console.log(' Video local cargado con MUTEO FORZADO (RTMP activo)');
        } else if (userHasInteracted) {
            localVideo.muted = false;
            localVideo.volume = 1;
        } else {
            localVideo.muted = true;
            localVideo.volume = 0;
        }

        localVideo.play().then(() => {
            if (!showingRtmp && audioEnabled && userHasInteracted) {
                localVideo.muted = false;
                console.log(' Audio local activado automáticamente');
            }
        }).catch(error => {
            console.error('Error al reproducir video:', error);
            localVideo.muted = true;
            localVideo.play().catch(e => {
                console.error('Error al reproducir video muteado:', e);
            });
        });

        setLocalStatus({
            text: `Video ${index + 1}/${videosList.length} - ${videoName}`,
            active: true
        });
    };

    const rotateLocalVideo = () => {
        let nextIndex;
        if (videosList.length <= 1) {
            nextIndex = 0;
        } else {
            do {
                nextIndex = Math.floor(Math.random() * videosList.length);
            } while (nextIndex === currentVideoIndex);
        }
        console.log(' Rotando a nuevo video aleatorio desde índice', currentVideoIndex, 'a', nextIndex);
        loadLocalVideo(nextIndex);
    };

    const switchToRtmp = (force = false) => {
        console.log(' switchToRtmp llamado - verificando condiciones...');
        console.log(' Estado actual:', {
            isRtmpAvailable,
            showingRtmp,
            hasHlsInstance: !!rtmpHlsRef.current,
            hlsReady: hlsReadyRef.current,
            videoElement: !!rtmpVideoRef.current
        });

        if (!isRtmpAvailable && !force) {
            console.warn(' switchToRtmp llamado pero isRtmpAvailable es false y no se forzó');
            return;
        }

        //  MEJORADO: Avoid redundant switches causing flicker
        if (showingRtmp && hlsReadyRef.current) {
            console.log(' Ya mostrando RTMP con HLS listo, verificando estado del video...');

            const rtmpVideo = rtmpVideoRef.current;
            if (rtmpVideo && rtmpVideo.paused) {
                console.log(' Video RTMP pausado, reactivando...');
                rtmpVideo.play().catch(error => {
                    console.error(' Error reactivando video RTMP:', error);
                });
            }

            // Ensure monitor running
            if (!playbackHealthIntervalRef.current) {
                startPlaybackHealthMonitor();
            }
            return;
        }

        console.log(' Cambiando a RTMP');
        setShowingRtmp(true);

        const rtmpVideo = rtmpVideoRef.current;
        const localVideo = localVideoRef.current;

        // Pausar y mutear video local inmediatamente
        if (localVideo) {
            localVideo.pause();
            forceLocalVideoMute();
        }

        if (userHasInteracted) {
            setAudioEnabled(true);
        }

        //  MEJORADO: Manejar reproducción del video más eficientemente
        if (rtmpVideo) {
            console.log(' Configurando video RTMP para reproducción...');

            //  NUEVO: Verificar que tenemos HLS listo antes de proceder
            if (!hlsReadyRef.current) {
                console.warn(' HLS no está listo, configurando...');
                setupRtmpStream();

                //  MEJORADO: Esperar a que HLS esté listo antes de reproducir
                const checkHlsReady = () => {
                    if (hlsReadyRef.current && rtmpVideo.paused) {
                        rtmpVideo.play().catch(error => {
                            console.error(' Error reproduciendo después de HLS ready:', error);
                        });
                    } else if (!hlsReadyRef.current) {
                        setTimeout(checkHlsReady, 200);
                    }
                };
                setTimeout(checkHlsReady, 500);

            } else {
                // Ya tenemos HLS listo, solo reproducir si es necesario
                if (rtmpVideo.paused) {
                    console.log(' Reproduciendo video RTMP...');
                    rtmpVideo.play().catch(error => {
                        console.error(' Error reproduciendo video RTMP:', error);
                    });
                }
            }

            //  NUEVO: RTMP siempre con audio activo
            rtmpVideo.muted = false;
            rtmpVideo.volume = 1;
            console.log(' Audio RTMP SIEMPRE activo (muted=false, volume=1)');
        }

        console.log(' Audio RTMP: configurado automáticamente');
        console.log(' Audio local: FORZOSAMENTE MUTEADO por conexión RTMP activa');
        startPlaybackHealthMonitor();
    };

    const switchToLocal = () => {
        console.log(' Cambiando a videos locales');
        setShowingRtmp(false);
        stopPlaybackHealthMonitor();

        const rtmpVideo = rtmpVideoRef.current;
        const localVideo = localVideoRef.current;

        //  CAMBIO: Restaurar audio local cuando no hay RTMP pero el stream sigue activo
        if (audioEnabled && userHasInteracted && localVideo) {
            localVideo.muted = false;
            localVideo.volume = 1;
            console.log(' Audio local: reactivado tras desconexión RTMP (muted=false, volume=1)');
        } else if (localVideo) {
            localVideo.muted = true;
            localVideo.volume = 0;
            console.log(' Audio local: mantenido muteado por configuración');
        }

        //  NUEVO: RTMP nunca se mutea, mantener audio activo
        if (rtmpVideo) {
            rtmpVideo.muted = false;
            rtmpVideo.volume = 1;
            console.log(' Audio RTMP mantenido activo incluso en modo local');
        }

        //  MEJORADO: Asegurar que los videos locales se reproduzcan correctamente
        if (videosList.length > 0) {
            // Si no hay video cargado o está vacío, cargar uno nuevo
            if (!localVideo || !localVideo.src || localVideo.src === '') {
                console.log('📽️ No hay video local cargado, iniciando reproducción de videos');
                startLocalVideo();
            } else {
                // Si hay video pero está pausado, reproducirlo
                if (localVideo.paused) {
                    console.log(' Reanudando video local pausado');
                    localVideo.play().catch(error => {
                        console.error('Error al reproducir video local pausado, cargando nuevo video:', error);
                        // Si falla la reproducción, cargar un video diferente
                        rotateLocalVideo();
                    });
                } else {
                    console.log(' Video local ya se está reproduciendo');
                }
            }
        } else {
            console.warn(' No hay videos disponibles para reproducir');
        }
    };

    const toggleAudio = () => {
        const newAudioEnabled = !audioEnabled;
        setAudioEnabled(newAudioEnabled);

        const rtmpVideo = rtmpVideoRef.current;
        const localVideo = localVideoRef.current;

        if (showingRtmp && rtmpVideo) {
            //  NUEVO: RTMP nunca se mutea, siempre activo
            rtmpVideo.muted = false;
            rtmpVideo.volume = 1;
            forceLocalVideoMute();
            console.log(' Audio RTMP: SIEMPRE activo (nunca se mutea)');
            console.log(' Audio local: FORZOSAMENTE muteado por conexión RTMP activa');
        } else if (localVideo) {
            localVideo.muted = !newAudioEnabled;
            localVideo.volume = newAudioEnabled ? 1 : 0;
            //  NUEVO: RTMP nunca se mutea
            if (rtmpVideo) {
                rtmpVideo.muted = false;
                rtmpVideo.volume = 1;
            }
            console.log(` Audio local: ${newAudioEnabled ? 'activado' : 'desactivado'}`);
        }

        console.log(`🎵 Audio general: ${newAudioEnabled ? 'ON' : 'OFF'}`);

        if (showingRtmp || isRtmpAvailable) {
            console.log(' POLÍTICA ACTIVA: Videos locales permanecen FORZOSAMENTE muteados mientras hay conexión RTMP');
        }

        if (newAudioEnabled) {
            console.log('🎙️ Audio activado - Listo para captura en OBS');
        }
    };

    const switchVideo = () => {
        if (showingRtmp && videosList.length > 0) {
            switchToLocal();
        } else if (!showingRtmp && isRtmpAvailable) {
            switchToRtmp();
        } else if (!showingRtmp) {
            rotateLocalVideo();
        }
    };

    const cleanup = () => {
        console.log(' Cleanup general del componente');

        if (socketRef.current) {
            socketRef.current.disconnect();
        }

        if (heartbeatIntervalRef.current) {
            clearInterval(heartbeatIntervalRef.current);
            heartbeatIntervalRef.current = null;
        }

        cleanupHLS();
        stopForcedMuteMonitor();
    };    // Event handlers for video elements
    // Event handlers for video elements
    const handleRtmpCanPlay = () => {
        console.log(' RTMP Video can play - estado:', {
            isRtmpAvailable,
            showingRtmp,
            paused: rtmpVideoRef.current?.paused,
            readyState: rtmpVideoRef.current?.readyState,
            currentTime: rtmpVideoRef.current?.currentTime
        });

        //  CORREGIDO: Cambio inmediato y directo cuando RTMP puede reproducir
        if (isRtmpAvailable && !showingRtmp) {
            console.log(' RTMP puede reproducir - CAMBIANDO INMEDIATAMENTE');
            setShowingRtmp(true);

            // Pausar video local inmediatamente
            const localVideo = localVideoRef.current;
            if (localVideo) {
                localVideo.pause();
                forceLocalVideoMute();
                console.log('⏸️ Video local pausado por cambio a RTMP');
            }

            const rtmpVideo = rtmpVideoRef.current;
            if (rtmpVideo) {
                //  NUEVO: RTMP siempre con audio activo
                rtmpVideo.muted = false;
                rtmpVideo.volume = 1;
                console.log(' Audio RTMP SIEMPRE activo (muted=false, volume=1)');

                if (rtmpVideo.paused) {
                    rtmpVideo.play().catch(error => {
                        console.error(' Error reproduciendo RTMP en canPlay:', error);
                    });
                }
            }

            startPlaybackHealthMonitor();
            console.log(' CAMBIO A RTMP COMPLETADO');

        } else if (isRtmpAvailable && showingRtmp) {
            console.log(' Ya mostrando RTMP, verificando reproducción y audio');
            const rtmpVideo = rtmpVideoRef.current;
            if (rtmpVideo) {
                //  NUEVO: RTMP siempre con audio activo
                rtmpVideo.muted = false;
                rtmpVideo.volume = 1;
                console.log(' Audio RTMP mantenido activo');

                if (rtmpVideo.paused) {
                    console.log(' Video pausado, reactivando');
                    rtmpVideo.play().catch(error => {
                        console.error(' Error reactivando desde canplay:', error);
                    });
                }
            }
        }
    };

    const handleLocalEnded = () => {
        console.log(' Video terminado, cambiando a uno aleatorio');
        rotateLocalVideo();
    };

    const handleLocalError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
        const videoEl = e.target as HTMLVideoElement;
        const error = videoEl?.error;
        console.error('Error en video local:', error);
        const errorCode = error ? error.code : 'unknown';
        console.log(' Código de error:', errorCode);

        if (errorCode === 3 || errorCode === 4) {
            console.log(' Error crítico, cambiando video en 3 segundos...');
            setTimeout(() => {
                rotateLocalVideo();
            }, 3000);
        } else {
            console.log(' Error menor, intentando continuar reproducción...');
            setTimeout(() => {
                const localVideo = localVideoRef.current;
                if (localVideo && localVideo.paused && !showingRtmp) {
                    localVideo.play().catch(() => {
                        console.log(' No se pudo reanudar, cambiando video...');
                        rotateLocalVideo();
                    });
                }
            }, 1000);
        }
    };

    const handleLocalLoadedData = () => {
        if (isRtmpAvailable) {
            forceLocalVideoMute();
            console.log(' Muteo forzado aplicado al cargar datos (RTMP activo)');
        }

        const localVideo = localVideoRef.current;
        if (localVideo && !showingRtmp) {
            if (localVideo.paused) {
                console.log(' Video local cargado y pausado, iniciando reproducción');
                localVideo.play().catch(error => {
                    console.error('Error al reproducir video después de cargar:', error);
                    // Si falla la reproducción, intentar con otro video
                    setTimeout(() => {
                        rotateLocalVideo();
                    }, 1000);
                });
            } else {
                console.log(' Video local cargado y ya se está reproduciendo');
            }
        }
    };

    const handleLocalVolumeChange = () => {
        const localVideo = localVideoRef.current;
        if (isRtmpAvailable && localVideo && (!localVideo.muted || localVideo.volume > 0)) {
            console.log(' DETECTADO: Cambio de volumen en video local durante RTMP - FORZANDO MUTEO');
            forceLocalVideoMute();
        }
    };

    return (
        <div className="relative w-screen h-screen bg-black text-white bg-back overflow-hidden">
            {/*  NUEVO: Pantalla de espera */}
            {isWaitingForStream && (
                <div className="absolute inset-0 bg-gradient-to-br from-gray-900 to-gray-800 flex flex-col justify-center items-center z-50">
                    <div className="text-4xl font-light mb-8 text-center text-white">
                        Esperando Stream
                    </div>

                    {/* Spinner animado */}
                    <div className="w-20 h-20 border-4 border-gray-400 border-l-blue-500 rounded-full animate-spin mb-8"></div>

                    <div className="text-xl text-gray-300 text-center opacity-80">
                        {waitingMessage}
                        <span className="inline-flex ml-1">
                            <span className="animate-pulse">.</span>
                            <span className="animate-pulse delay-150">.</span>
                            <span className="animate-pulse delay-300">.</span>
                        </span>
                        <br />
                        <br />
                        <span className="text-sm">Stream ID: {STREAM_KEY.substring(0, 8)}...</span>
                    </div>
                </div>
            )}

            {/*  NUEVO: Indicador de estado RTMP */}
            <div className="fixed top-4 right-4 z-40">
                <div className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${rtmpStatusMonitor === 'ACTIVE'
                    ? 'bg-green-500 text-white shadow-lg'
                    : rtmpStatusMonitor === 'INACTIVE'
                        ? 'bg-orange-500 text-white shadow-lg'
                        : rtmpStatusMonitor === 'STOPPED'
                            ? 'bg-red-500 text-white shadow-lg'
                            : rtmpStatusMonitor === 'ERROR'
                                ? 'bg-red-600 text-white shadow-lg animate-pulse'
                                : 'bg-gray-500 text-white shadow-lg'
                    }`}>
                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${rtmpStatusMonitor === 'ACTIVE' ? 'bg-white animate-pulse' : 'bg-white/70'
                            }`}></div>
                        <span>
                            RTMP: {rtmpStatusMonitor === 'UNKNOWN' ? 'Conectando...' : rtmpStatusMonitor}
                        </span>
                        {lastRtmpCheck && (
                            <span className="text-xs opacity-75">
                                {lastRtmpCheck.toLocaleTimeString()}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Video Container */}
            <div className="relative w-full h-full bg-black">
                {/* RTMP Video */}
                <video
                    ref={rtmpVideoRef}
                    preload="auto"
                    className={`absolute inset-0 w-full h-full object-contain bg-black transition-opacity duration-700 z-10 ${showingRtmp ? 'opacity-100' : 'opacity-0'
                        }`}
                    autoPlay
                    playsInline
                    onCanPlay={handleRtmpCanPlay}
                    onPlay={() => console.log(' RTMP Video started playing')}
                    onPause={() => console.log('⏸️ RTMP Video paused')}
                    onWaiting={() => console.log(' RTMP Video waiting for data')}
                    onLoadStart={() => console.log('📥 RTMP Video load started')}
                    onLoadedData={() => console.log(' RTMP Video data loaded')}
                    onError={(e) => {
                        const video = e.target as HTMLVideoElement;
                        console.error(' RTMP Video error:', video.error);
                    }}
                />

                {/* Local Video */}
                {!showingRtmp && !isWaitingForStream && (
                    <h1 className='fixed text-white text-4xl p-10 z-50 translate-y-1/2 w-screen text-center text-shadow-md text-shadow-black '>
                        Restableciendo conexión...
                    </h1>
                )}
                <video
                    ref={localVideoRef}
                    className={`absolute inset-0 w-full h-full object-contain bg-black transition-opacity duration-700 z-5 ${!showingRtmp ? 'opacity-100' : 'opacity-0'
                        }`}
                    autoPlay
                    muted
                    playsInline
                    onEnded={handleLocalEnded}
                    onError={handleLocalError}
                    onLoadedData={handleLocalLoadedData}
                    onVolumeChange={handleLocalVolumeChange}
                >
                </video>
            </div>

            {/* Controls */}
            <div className="fixed hidden top-5 right-5 bg-black bg-opacity-80 p-5 rounded-lg z-50">
                {/* RTMP Status */}
                {/*         <div className={`mb-3 p-3 rounded-md ${
          rtmpStatus.active ? 'bg-green-500 bg-opacity-30' : 'bg-red-500 bg-opacity-30'
        }`}>
          <div className="text-sm">
            RTMP: <span className="font-semibold">{rtmpStatus.text}</span>
          </div>
        </div>
        
        <div className={`mb-3 p-3 rounded-md ${
          localStatus.active ? 'bg-green-500 bg-opacity-30' : 'bg-red-500 bg-opacity-30'
        }`}>
          <div className="text-sm">
            Video Local: <span className="font-semibold">{localStatus.text}</span>
          </div>
        </div> */}

                {/* Control Buttons */}
                {/*         <div className="flex flex-col gap-2">
          <button
            onClick={toggleAudio}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 flex items-center justify-center gap-2"
          >
             Audio
          </button>
          
          <button
            onClick={switchVideo}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 flex items-center justify-center gap-2"
          >
             Cambiar
          </button>
        </div> */}
            </div>

            {/* Debug Info */}
            <div className="fixed hidden bottom-5 left-5 bg-black bg-opacity-80 p-3 rounded-lg z-50 text-xs">
                <div>Stream Key: {STREAM_KEY}</div>
                <div>Socket: {SOCKET_URL}</div>
                <div>Videos: {videosList.length}</div>
                <div>RTMP: {isRtmpAvailable ? 'Disponible' : 'No disponible'}</div>
                <div>Mostrando: {showingRtmp ? 'RTMP' : 'Local'}</div>
                <div>Audio: {audioEnabled ? 'ON' : 'OFF'}</div>
            </div>
        </div>
    );
};

export default Live;