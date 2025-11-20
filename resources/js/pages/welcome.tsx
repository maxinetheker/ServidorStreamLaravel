import { type SharedData } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';


export default function Welcome() {
    const { auth } = usePage<SharedData>().props;
    return (
        <>
            <Head title="Stream FF - Streaming Cloud">
                <link rel="preconnect" href="https://fonts.bunny.net" />
                <link
                    href="https://fonts.bunny.net/css?family=instrument-sans:400,500,600,700&display=swap"
                    rel="stylesheet"
                />
            </Head>
            <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#050B16] text-slate-100">
                {/* Fondos decorativos */}
                <div className="pointer-events-none absolute inset-0 -z-10">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,#1E3A8A_0%,rgba(30,58,138,0)_60%)] opacity-60" />
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_70%,#2563EB_0%,rgba(37,99,235,0)_55%)] opacity-40" />
                    <div className="absolute inset-0 bg-gradient-to-b from-[#050B16] via-[#081021] to-[#050B16]" />
                </div>
                {/* Navegación superior */}
                <header className="flex w-full items-center justify-between px-6 py-4 md:px-10">
                    <div className="flex items-center gap-3">
                        <div className="flex  items-center justify-center  border border-white/10 bg-white backdrop-blur-sm ">
                            <img src="/streamff-logo3.png" alt="Stream FF Logo" className="h-12 w-12" />
                        </div>
                        <div className="flex flex-col leading-tight">
                            <span className="text-lg font-semibold tracking-wide text-white">Stream FF</span>
                            <span className="text-[11px] uppercase tracking-[0.15em] text-slate-400">Streaming Cloud</span>
                        </div>
                    </div>
                    <nav className="flex items-center gap-4 text-sm">
                        {auth.user ? (
                            <Link
                                href={route('dashboard')}
                                className="rounded-md bg-white/5 px-4 py-2 font-medium text-slate-200 ring-1 ring-white/10 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
                            >
                                Dashboard
                            </Link>
                        ) : (
                            <>
                                <Link
                                    href={route('login')}
                                    className="rounded-md px-4 py-2 font-medium text-slate-300 transition hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
                                >
                                    Iniciar sesión
                                </Link>
                                <Link
                                    href={route('register')}
                                    className="rounded-md bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-2 font-medium text-white shadow-sm shadow-blue-600/30 transition hover:from-blue-500 hover:to-blue-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60"
                                >
                                    Registrarse
                                </Link>
                            </>
                        )}
                    </nav>
                </header>
                {/* Hero */}
                <main className="flex flex-1 items-center justify-center px-6 pb-16 pt-4 md:px-10 lg:pt-0">
                    <div className="flex w-full max-w-6xl flex-col-reverse items-center gap-12 lg:flex-row lg:items-stretch">
                        {/* Columna izquierda */}
                        <section className="relative z-10 flex w-full flex-1 flex-col justify-center">
                            <h1 className="mb-4 max-w-xl bg-gradient-to-r from-blue-400 via-blue-200 to-sky-400 bg-clip-text text-4xl font-bold tracking-tight text-transparent md:text-5xl lg:text-6xl">
                                Transmite. Replica. Escala.
                            </h1>
                            <p className="mb-8 max-w-lg text-base leading-relaxed text-slate-300 md:text-lg">
                                Stream FF te ayuda a distribuir video en vivo y contenido bajo demanda a múltiples plataformas con baja latencia, observabilidad avanzada y un flujo de trabajo simple. Diseñado para creadores, empresas y equipos modernos.
                            </p>
                            <div className="mb-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                                {auth.user ? (
                                    <Link
                                        href={route('dashboard')}
                                        className="group inline-flex items-center justify-center gap-2 rounded-md bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 text-sm font-semibold tracking-wide text-white shadow-lg shadow-blue-700/30 transition hover:from-blue-500 hover:to-indigo-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60"
                                    >
                                        Ir al panel <span className="transition-transform group-hover:translate-x-0.5">→</span>
                                    </Link>
                                ) : (
                                    <Link
                                        href={route('register')}
                                        className="group inline-flex items-center justify-center gap-2 rounded-md bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 text-sm font-semibold tracking-wide text-white shadow-lg shadow-blue-700/30 transition hover:from-blue-500 hover:to-indigo-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60"
                                    >
                                        Comenzar gratis <span className="transition-transform group-hover:translate-x-0.5">→</span>
                                    </Link>
                                )}
                                {!auth.user && (
                                    <Link
                                        href={route('login')}
                                        className="inline-flex items-center justify-center rounded-md border border-white/10 bg-white/5 px-6 py-3 text-sm font-medium text-slate-200 backdrop-blur-sm transition hover:border-white/20 hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
                                    >
                                        Ya tengo cuenta
                                    </Link>
                                )}
                            </div>
                            <div className="grid w-full max-w-2xl grid-cols-2 gap-4 text-xs text-slate-400 md:max-w-xl md:text-sm lg:max-w-2xl">
                                {[
                                    { title: 'Ingestión RTMP / SRT', desc: 'Entrada desde OBS y encoders; monitorización del dispositivo RTMP.' },
                                    { title: 'HLS optimizado', desc: 'Reproducción con HLS.js para baja latencia y reconexión robusta.' },
                                    { title: 'Fallback & VOD', desc: 'Reproducción de videos de respaldo y almacenamiento para VOD/clips.' },
                                    { title: 'Control OBS (WebSocket)', desc: 'Conecta y controla instancias OBS: cambiar escenas, start/stop y telemetría.' },
                                    { title: 'API, Stream Key & Webhooks', desc: 'Genera Stream Keys, integra mediante API y recibe eventos vía webhooks.' },
                                ].map((f) => (
                                    <div
                                        key={f.title}
                                        className="group rounded-lg border border-white/5 bg-white/[0.03] p-4 backdrop-blur-sm transition hover:border-blue-500/30 hover:bg-blue-500/[0.07]"
                                    >
                                        <h3 className="mb-1 font-medium text-slate-200 group-hover:text-white">{f.title}</h3>
                                        <p className="text-[11px] leading-relaxed text-slate-400 group-hover:text-slate-300 md:text-[12px]">{f.desc}</p>
                                    </div>
                                ))}
                            </div>
                        </section>
                        {/* Panel visual */}
                        <aside className="relative flex w-full max-w-lg flex-1 items-center justify-center">
                            <div className="relative aspect-[16/10] w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#0F1E33] via-[#0B1324] to-[#070C16] p-6 shadow-2xl shadow-black/50 ring-1 ring-white/5">
                            <video className="absolute inset-0 h-full w-full object-cover" src='/video/video1.mp4' autoPlay loop muted />
                                <div className="absolute inset-0 opacity-50 mix-blend-screen">
                                    <div className="absolute -left-1/4 -top-1/4 h-[140%] w-[140%] animate-pulse rounded-full bg-[radial-gradient(circle_at_30%_30%,#1E40AF,transparent_60%)]" />
                                    <div className="absolute -bottom-1/4 -right-1/4 h-[140%] w-[140%] animate-pulse rounded-full bg-[radial-gradient(circle_at_70%_70%,#2563EB,transparent_60%)] animation-delay-200" />
                                </div>
                                <div className="relative flex h-full flex-col justify-between">
                                    <div className="flex items-center justify-between">
                                        <span className="rounded-md bg-blue-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-blue-300 ring-1 ring-inset ring-blue-400/30">Live Preview</span>
                                        <span className="text-[10px] text-slate-400">beta</span>
                                    </div>
                                    <div className="mt-4 flex flex-1 flex-col items-center justify-center text-center">
                                        <img src="/streamff-logo3.png" alt="Stream FF Logo" className="mb-4 h-20 w-20 rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm" />
{/*                                         <p className="mb-2 text-sm font-medium text-slate-200">Espacio para tu logo</p>
                                        <p className="text-[11px] leading-relaxed text-slate-400">Reemplaza este contenedor con tu identidad visual y comienza a transmitir.</p> */}
                                    </div>
                                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                                        <span>Stream FF © {new Date().getFullYear()}</span>
                                        <span className="text-slate-600">v0.1</span>
                                    </div>
                                </div>
                            </div>
                        </aside>
                    </div>
                </main>
                <footer className="px-6 pb-6 text-center text-[11px] text-slate-500 md:px-10">Construido por Kervi Falcón.</footer>
            </div>
        </>
    );
}
