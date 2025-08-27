import AppLogoIcon from '@/components/app-logo-icon';
import { Link } from '@inertiajs/react';
import { type PropsWithChildren } from 'react';

interface AuthLayoutProps {
    name?: string;
    title?: string;
    description?: string;
}

export default function AuthSimpleLayout({ children, title, description }: PropsWithChildren<AuthLayoutProps>) {
    return (
        <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#050B16] px-5 py-12 text-slate-100 md:px-10">
            {/* Fondos decorativos reutilizando la paleta del landing */}
            <div className="pointer-events-none absolute inset-0 -z-10">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,#1E3A8A_0%,rgba(30,58,138,0)_60%)] opacity-60" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_75%,#2563EB_0%,rgba(37,99,235,0)_55%)] opacity-40" />
                <div className="absolute inset-0 bg-gradient-to-b from-[#050B16] via-[#081021] to-[#050B16]" />
                <div className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/5 blur-3xl" />
            </div>

            <div className="w-full max-w-md">
                <div className="relative rounded-2xl border border-white/10 bg-white/[0.04] p-8 shadow-xl shadow-black/40 backdrop-blur-xl ring-1 ring-white/5">
                    <div className="absolute -inset-px rounded-2xl bg-gradient-to-br from-white/10 via-transparent to-white/5 opacity-20" />
                    <div className="relative flex flex-col items-center gap-7">
                        <Link
                            href={route('home')}
                            className="group flex flex-col items-center gap-3 font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
                        >
                            <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-white/10 bg-white/5 shadow-inner shadow-blue-500/10 ring-1 ring-white/10 backdrop-blur">
                                <AppLogoIcon className="size-10 text-blue-300 drop-shadow-[0_0_6px_rgba(37,99,235,0.45)]" />
                            </div>
                            <span className="sr-only">{title}</span>
                        </Link>

                        <div className="space-y-2 text-center">
                            {title && (
                                <h1 className="bg-gradient-to-r from-blue-400 via-blue-200 to-sky-400 bg-clip-text text-xl font-semibold tracking-tight text-transparent md:text-2xl">
                                    {title}
                                </h1>
                            )}
                            {description && (
                                <p className="mx-auto max-w-sm text-xs leading-relaxed text-slate-400 md:text-sm">
                                    {description}
                                </p>
                            )}
                        </div>
                        <div className="relative w-full">{children}</div>
                    </div>
                </div>
                <p className="mt-8 text-center text-[11px] text-slate-500">
                    Stream FF © {new Date().getFullYear()} · Construido con Laravel + Inertia
                </p>
            </div>
        </div>
    );
}
