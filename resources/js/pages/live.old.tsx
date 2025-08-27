import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

// Minimal HLS Type (since HLS is loaded dynamically via CDN). If you later add the hls.js package, replace this with: import Hls from 'hls.js';
type HlsInstance = {
    loadSource: (src: string) => void;
    attachMedia: (media: HTMLMediaElement) => void;
    destroy: () => void;
    stopLoad: () => void;
    startLoad: () => void;
    on: (event: any, handler: (...args: any[]) => void) => void;
};
type HlsStatic = {
    new(config?: any): HlsInstance;
    isSupported: () => boolean;
    Events: Record<string, string>;
};

declare global {
    interface Window {
        Hls?: HlsStatic;
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
    // Environment variables (simuladas para este ejemplo)
    const SOCKET_URL = process.env.SOCKET_URL || 'https://live.streamff.repo.net.pe';
    const STREAM_KEY = streamKey;
    const HLS_BASE_URL = process.env.HLS_BASE_URL || 'https://live.streamff.repo.net.pe';

    // Video references
    const rtmpVideoRef = useRef<HTMLVideoElement | null>(null);
    const localVideoRef = useRef<HTMLVideoElement | null>(null);

    // Socket reference
    const socketRef = useRef<Socket | null>(null);

    // HLS reference
    const rtmpHlsRef = useRef<HlsInstance | null>(null);

    // Intervals
    const forcedMuteIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // State
    const [isRtmpAvailable, setIsRtmpAvailable] = useState<boolean>(false);
    const [currentVideoIndex, setCurrentVideoIndex] = useState<number>(0);
    const [videosList, setVideosList] = useState<string[]>([]);
    const [audioEnabled, setAudioEnabled] = useState<boolean>(true);
    const [showingRtmp, setShowingRtmp] = useState<boolean>(false);
    const [userHasInteracted, setUserHasInteracted] = useState<boolean>(true);
    const [rtmpStatus, setRtmpStatus] = useState<Status>({ text: 'Desconectado', active: false });
    const [localStatus, setLocalStatus] = useState<Status>({ text: 'Activo', active: true });

    // Initialize HLS library
    useEffect(() => {
        // Load HLS.js from CDN
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/hls.js@latest';
        script.onload = () => {
            console.log('HLS.js loaded successfully');
        };
        document.head.appendChild(script);

        return () => {
            document.head.removeChild(script);
        };
    }, []);

    // Initialize component
    useEffect(() => {
        console.log('🚀 Inicializando viewer para:', STREAM_KEY);

        enableAutoAudio();
        setupEventListeners();
        connectSocket();

        return () => {
            cleanup();
        };
    }, []);

    // Setup RTMP stream when HLS is available and RTMP status changes
    useEffect(() => {
        if (window.Hls && isRtmpAvailable) {
            setupRtmpStream();
        }
    }, [isRtmpAvailable]);

    // Start local video when videos list changes
    useEffect(() => {
        if (videosList.length > 0) {
            startLocalVideo();
        }
    }, [videosList]);

    const enableAutoAudio = () => {
        console.log('🔊 Activando audio automáticamente para OBS');
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
            console.log('⚠️ No se pudo crear contexto de audio:', error);
        }
    };

    const setupEventListeners = () => {
        // Will be set up in useEffect for each video element
    };

    const connectSocket = () => {
        socketRef.current = io(SOCKET_URL, {});

        socketRef.current.on('connect', () => {
            console.log('🔌 Socket conectado');
            socketRef.current?.emit('join', STREAM_KEY);
        });

        socketRef.current.on('deviceStatusChange', (data: { rtmpAvailable: boolean; videosList: string[] }) => {
            console.log('📱 Device status change:', data);
            handleRtmpStatusChange(data.rtmpAvailable, data.videosList);
        });

        socketRef.current.on('disconnect', () => {
            console.log('🔌 Socket desconectado');
        });
    };

    const handleRtmpStatusChange = (rtmpAvailable: boolean, videosList?: string[]) => {
        const wasAvailable = isRtmpAvailable;
        setIsRtmpAvailable(rtmpAvailable);

        if (videosList && videosList.length > 0) {
            setVideosList(videosList);
            console.log('📁 Videos recibidos:', videosList);
        }

        if (rtmpAvailable && !wasAvailable) {
            console.log('📡 RTMP reconectado - esperando stream HLS');
            console.log('🔇 FORZANDO MUTEO PERMANENTE de videos locales por nueva conexión RTMP');

            forceLocalVideoMute();
            startForcedMuteMonitor();

            setRtmpStatus({ text: 'Reconectando...', active: true });

            if (rtmpHlsRef.current) {
                rtmpHlsRef.current.destroy();
                rtmpHlsRef.current = null;
            }

            waitForHLSAvailability(() => {
                setTimeout(() => {
                    setRtmpStatus({ text: 'Conectado', active: true });
                    switchToRtmp();
                }, 1000);
            });

        } else if (rtmpAvailable) {
            setRtmpStatus({ text: 'Conectado', active: true });
            forceLocalVideoMute();
            startForcedMuteMonitor();
            console.log('🔇 Videos locales FORZOSAMENTE muteados - RTMP activo');
            setTimeout(() => switchToRtmp(), 500);

        } else {
            stopForcedMuteMonitor();
            setRtmpStatus({ text: 'Desconectado', active: false });
            console.log('🔊 RTMP desconectado - restaurando audio de videos locales');
            switchToLocal();
        }
    };

    const forceLocalVideoMute = () => {
        const localVideo = localVideoRef.current;
        if (localVideo) {
            localVideo.muted = true;
            localVideo.volume = 0;
            console.log('🔇 MUTEO FORZADO aplicado a video local (muted=true, volume=0)');
        }
    };

    const startForcedMuteMonitor = () => {
        stopForcedMuteMonitor();

        console.log('🔍 Iniciando monitor de muteo forzado para videos locales');
        forcedMuteIntervalRef.current = setInterval(() => {
            const localVideo = localVideoRef.current;
            const rtmpVideo = rtmpVideoRef.current;

            if (isRtmpAvailable && localVideo) {
                if (!localVideo.muted || localVideo.volume > 0) {
                    console.log('⚠️ DETECTADO: Video local intentó activar audio durante RTMP - FORZANDO MUTEO');
                    forceLocalVideoMute();
                }

                if (showingRtmp && rtmpVideo && rtmpVideo.muted && audioEnabled) {
                    console.log('🔊 Reactivando audio RTMP que fue muteado accidentalmente');
                    rtmpVideo.muted = false;
                }
            }
        }, 500);
    };

    const stopForcedMuteMonitor = () => {
        if (forcedMuteIntervalRef.current) {
            clearInterval(forcedMuteIntervalRef.current);
            forcedMuteIntervalRef.current = null;
            console.log('🛑 Monitor de muteo forzado detenido');
        }
    };

    const waitForHLSAvailability = (callback: () => void) => {
        const maxWait = 15000;
        const checkInterval = 500;
        let elapsed = 0;

        const checkHLS = async () => {
            try {
                const hlsUrl = `${HLS_BASE_URL}/stream_${STREAM_KEY}.m3u8`;
                const response = await fetch(hlsUrl);
                if (response.ok) {
                    const content = await response.text();
                    if (content.includes('#EXTM3U') && content.includes('.ts')) {
                        console.log('✅ HLS disponible en el cliente');
                        callback();
                        return;
                    }
                }
            } catch (error) {
                // Stream aún no disponible
            }

            elapsed += checkInterval;
            if (elapsed < maxWait) {
                setTimeout(checkHLS, checkInterval);
            } else {
                console.log('⏰ Timeout esperando HLS en cliente');
                callback();
            }
        };

        setTimeout(checkHLS, checkInterval);
    };

    const setupRtmpStream = () => {
        const streamUrl = `${HLS_BASE_URL}/stream_${STREAM_KEY}.m3u8`;
        const rtmpVideo = rtmpVideoRef.current;

        if (!rtmpVideo || !window.Hls) return;

        if (rtmpHlsRef.current) {
            rtmpHlsRef.current.destroy();
            rtmpHlsRef.current = null;
        }

        if (window.Hls.isSupported()) {
            rtmpHlsRef.current = new window.Hls({
                // ========== CONFIGURACIÓN AGRESIVA PARA BAJA LATENCIA ==========
                lowLatencyMode: true,
                backBufferLength: 5,           // REDUCIDO: Solo 5s de buffer trasero
                maxBufferLength: 10,           // REDUCIDO: Máximo 10s buffer total
                maxBufferSize: 60 * 1000 * 1000, // 60MB max buffer
                maxBufferHole: 0.1,            // Saltar huecos pequeños inmediatamente
                liveSyncDurationCount: 1,      // REDUCIDO: Sincronizar con 1 segmento
                liveMaxLatencyDurationCount: 2, // REDUCIDO: Máximo 2 segmentos de latencia
                maxLiveSyncPlaybackRate: 1.5,  // Acelerar reproducción si hay lag
                enableWorker: true,
                startLevel: -1,
                autoStartLoad: true,
                startPosition: -1,             // Empezar desde el final (live edge)
                debug: false,
                // ========== CONFIGURACIÓN ADICIONAL PARA FLUJO CONTINUO ==========
                manifestLoadingTimeOut: 2000,  // Timeout rápido para manifests
                manifestLoadingMaxRetry: 1,    // Menos reintentos
                levelLoadingTimeOut: 2000,     // Timeout rápido para levels
                fragLoadingTimeOut: 3000,      // Timeout para fragmentos
                fragLoadingMaxRetry: 2,        // Máximo 2 reintentos por fragmento
                abrEwmaFastLive: 2.0,          // ABR más rápido para live
                abrEwmaSlowLive: 5.0
            });

            rtmpHlsRef.current.loadSource(streamUrl);
            rtmpHlsRef.current.attachMedia(rtmpVideo);

            rtmpHlsRef.current.on(window.Hls.Events.ERROR, (_event: any, data: any) => {
                console.log('🔄 HLS Error:', data.type, data.details);
                if (data.fatal) {
                    console.log('❌ HLS Fatal error, cambiando a video local');
                    switchToLocal();
                }
            });

            // ========== EVENTOS ADICIONALES PARA DIAGNÓSTICO ==========
            rtmpHlsRef.current.on(window.Hls.Events.FRAG_LOADED, (_event: any, data: any) => {
                console.log('📦 Fragmento cargado:', {
                    seq: data.frag.sn,
                    duration: data.frag.duration,
                    loadTime: data.stats.total
                });
            });

            rtmpHlsRef.current.on(window.Hls.Events.BUFFER_APPENDED, (_event: any, data: any) => {
                const video = rtmpVideoRef.current;
                if (video) {
                    const buffered = video.buffered;
                    const currentTime = video.currentTime;
                    let bufferAhead = 0;
                    
                    for (let i = 0; i < buffered.length; i++) {
                        if (currentTime >= buffered.start(i) && currentTime <= buffered.end(i)) {
                            bufferAhead = buffered.end(i) - currentTime;
                            break;
                        }
                    }
                    
                    console.log('📊 Buffer:', {
                        currentTime: currentTime.toFixed(2),
                        bufferAhead: bufferAhead.toFixed(2),
                        type: data.type
                    });
                    
                    // Si hay demasiado buffer, saltar al live edge
                    if (bufferAhead > 4) {
                        console.log('⚡ Demasiado buffer, saltando al live edge');
                        video.currentTime = buffered.end(buffered.length - 1) - 0.5;
                    }
                }
            });

            rtmpHlsRef.current.on(window.Hls.Events.MANIFEST_PARSED, () => {
                console.log('✅ RTMP HLS: Manifest parseado correctamente');
                
                // Forzar inicio inmediato en live edge
                const video = rtmpVideoRef.current;
                if (video && rtmpHlsRef.current) {
                    setTimeout(() => {
                        if (video.seekable.length > 0) {
                            const livePosition = video.seekable.end(video.seekable.length - 1) - 0.5;
                            video.currentTime = livePosition;
                            console.log('🎯 Posicionado en live edge:', livePosition);
                        }
                    }, 100);
                }
            });

            console.log('🎬 HLS configurado para stream:', streamUrl);

        } else if (rtmpVideo.canPlayType('application/vnd.apple.mpegurl')) {
            rtmpVideo.src = streamUrl;
            console.log('🎬 Video nativo configurado para stream:', streamUrl);
        } else {
            console.log('❌ HLS no soportado en este navegador');
        }
    };

    const startLocalVideo = () => {
        if (videosList.length === 0) {
            console.log('⚠️ No hay videos disponibles');
            return;
        }

        const randomIndex = Math.floor(Math.random() * videosList.length);
        loadLocalVideo(randomIndex);
        console.log('🎬 Rotación automática por tiempo DESHABILITADA - videos cambiarán solo al terminar');
    };

    const loadLocalVideo = (index: number) => {
        if (videosList.length === 0) return;

        index = index % videosList.length;
        setCurrentVideoIndex(index);

        const videoUrl = videosList[index];
        const videoName = videoUrl.split('/').pop();
        const localVideo = localVideoRef.current;

        if (!localVideo) return;

        console.log('🎲 Reproduciendo video aleatorio [' + (index + 1) + '/' + videosList.length + ']:', videoName);

        localVideo.src = videoUrl;
        localVideo.load();

        if (isRtmpAvailable) {
            localVideo.muted = true;
            localVideo.volume = 0;
            console.log('🔇 Video local cargado con MUTEO FORZADO (RTMP activo)');
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
                console.log('🔊 Audio local activado automáticamente');
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
        console.log('🔄 Rotando a nuevo video aleatorio desde índice', currentVideoIndex, 'a', nextIndex);
        loadLocalVideo(nextIndex);
    };

    const switchToRtmp = () => {
        if (!isRtmpAvailable) return;

        console.log('🔄 Cambiando a RTMP');
        setShowingRtmp(true);

        const rtmpVideo = rtmpVideoRef.current;
        const localVideo = localVideoRef.current;

        if (userHasInteracted) {
            setAudioEnabled(true);
        }

        if (rtmpVideo && rtmpVideo.paused && rtmpHlsRef.current) {
            console.log('📺 RTMP pausado, refrescando HLS stream...');
            try {
                rtmpHlsRef.current.stopLoad();
                setTimeout(() => {
                    rtmpHlsRef.current?.startLoad();
                    rtmpVideo.play().catch(e => {
                        console.log('⚠️ Error reanudando RTMP:', e);
                    });
                }, 500);
            } catch (error) {
                console.log('⚠️ Error refrescando HLS:', error);
            }
        } else if (rtmpVideo && rtmpVideo.paused) {
            rtmpVideo.play().catch(e => {
                console.log('⚠️ Error reanudando RTMP:', e);
            });
        }

        if (rtmpVideo) rtmpVideo.muted = false;
        forceLocalVideoMute();

        console.log('🔊 Audio RTMP: activado automáticamente');
        console.log('🔇 Audio local: FORZOSAMENTE MUTEADO por conexión RTMP activa');
    };

    const switchToLocal = () => {
        console.log('🔄 Cambiando a video local');
        setShowingRtmp(false);

        const rtmpVideo = rtmpVideoRef.current;
        const localVideo = localVideoRef.current;

        if (audioEnabled && userHasInteracted && localVideo) {
            localVideo.muted = false;
            localVideo.volume = 1;
            console.log('🔊 Audio local: reactivado tras desconexión RTMP (muted=false, volume=1)');
        } else if (localVideo) {
            localVideo.muted = true;
            localVideo.volume = 0;
            console.log('🔇 Audio local: mantenido muteado por configuración');
        }

        if (rtmpVideo) rtmpVideo.muted = true;

        if (localVideo && localVideo.paused) {
            localVideo.play();
        }
    };

    const toggleAudio = () => {
        const newAudioEnabled = !audioEnabled;
        setAudioEnabled(newAudioEnabled);

        const rtmpVideo = rtmpVideoRef.current;
        const localVideo = localVideoRef.current;

        if (showingRtmp && rtmpVideo) {
            rtmpVideo.muted = !newAudioEnabled;
            forceLocalVideoMute();
            console.log(`🔊 Audio RTMP: ${newAudioEnabled ? 'activado' : 'desactivado'}`);
            console.log('🔇 Audio local: FORZOSAMENTE muteado por conexión RTMP activa');
        } else if (localVideo) {
            localVideo.muted = !newAudioEnabled;
            localVideo.volume = newAudioEnabled ? 1 : 0;
            if (rtmpVideo) rtmpVideo.muted = true;
            console.log(`🔊 Audio local: ${newAudioEnabled ? 'activado' : 'desactivado'}`);
        }

        console.log(`🎵 Audio general: ${newAudioEnabled ? 'ON' : 'OFF'}`);

        if (showingRtmp || isRtmpAvailable) {
            console.log('📡 POLÍTICA ACTIVA: Videos locales permanecen FORZOSAMENTE muteados mientras hay conexión RTMP');
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
        if (socketRef.current) {
            socketRef.current.disconnect();
        }

        if (rtmpHlsRef.current) {
            rtmpHlsRef.current.destroy();
        }

        stopForcedMuteMonitor();
    };

    // Event handlers for video elements
    const handleRtmpCanPlay = () => {
        if (isRtmpAvailable) {
            switchToRtmp();
        }
    };

    const handleLocalEnded = () => {
        console.log('🎬 Video terminado, cambiando a uno aleatorio');
        rotateLocalVideo();
    };

    const handleLocalError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
        const videoEl = e.target as HTMLVideoElement;
        const error = videoEl?.error;
        console.error('Error en video local:', error);
        const errorCode = error ? error.code : 'unknown';
        console.log('🔍 Código de error:', errorCode);

        if (errorCode === 3 || errorCode === 4) {
            console.log('❌ Error crítico, cambiando video en 3 segundos...');
            setTimeout(() => {
                rotateLocalVideo();
            }, 3000);
        } else {
            console.log('⚠️ Error menor, intentando continuar reproducción...');
            setTimeout(() => {
                const localVideo = localVideoRef.current;
                if (localVideo && localVideo.paused && !showingRtmp) {
                    localVideo.play().catch(() => {
                        console.log('🔄 No se pudo reanudar, cambiando video...');
                        rotateLocalVideo();
                    });
                }
            }, 1000);
        }
    };

    const handleLocalLoadedData = () => {
        if (isRtmpAvailable) {
            forceLocalVideoMute();
            console.log('🔇 Muteo forzado aplicado al cargar datos (RTMP activo)');
        }

        const localVideo = localVideoRef.current;
        if (localVideo && !showingRtmp) {
            localVideo.play().catch(error => {
                console.error('Error al reproducir video después de cargar:', error);
            });
        }
    };

    const handleLocalVolumeChange = () => {
        const localVideo = localVideoRef.current;
        if (isRtmpAvailable && localVideo && (!localVideo.muted || localVideo.volume > 0)) {
            console.log('⚠️ DETECTADO: Cambio de volumen en video local durante RTMP - FORZANDO MUTEO');
            forceLocalVideoMute();
        }
    };

    return (
        <div className="relative w-screen h-screen bg-black text-white bg-back overflow-hidden">
            {/* Video Container */}
            <div className="relative w-full h-full bg-black">
                {/* RTMP Video */}
                <video
                    ref={rtmpVideoRef}
                    className={`absolute inset-0 w-full h-full object-contain bg-black transition-opacity duration-700 z-10 ${showingRtmp ? 'opacity-100' : 'opacity-0'
                        }`}
                    autoPlay
                    muted
                    playsInline
                    onCanPlay={handleRtmpCanPlay}
                />

                {/* Local Video */}
                {!showingRtmp && (<><h1 className='fixed text-white text-4xl p-10 z-50 translate-y-1/2 w-screen text-center text-shadow-md text-shadow-black '>Restableciendo conexión...</h1></>)}
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
            <div className="fixed top-5 right-5 bg-black bg-opacity-80 p-5 rounded-lg z-50">
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
            🔊 Audio
          </button>
          
          <button
            onClick={switchVideo}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 flex items-center justify-center gap-2"
          >
            🔄 Cambiar
          </button>
        </div> */}
            </div>

            {/* Debug Info */}
        {/*      <div className="fixed bottom-5 left-5 bg-black bg-opacity-80 p-3 rounded-lg z-50 text-xs">
                <div>Stream Key: {STREAM_KEY}</div>
                <div>Socket: {SOCKET_URL}</div>
                <div>Videos: {videosList.length}</div>
                <div>RTMP: {isRtmpAvailable ? 'Disponible' : 'No disponible'}</div>
                <div>Mostrando: {showingRtmp ? 'RTMP' : 'Local'}</div>
                <div>Audio: {audioEnabled ? 'ON' : 'OFF'}</div>
            </div>*/}
        </div>
    );
};

export default Live;