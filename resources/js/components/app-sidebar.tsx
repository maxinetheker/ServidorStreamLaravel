import { NavFooter } from '@/components/nav-footer';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { type NavItem } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import { AlignVerticalDistributeStartIcon, BookOpen, Folder, LayoutDashboard, LayoutGrid, PlayIcon, Settings, TowerControl, Video } from 'lucide-react';
import AppLogo from './app-logo';
import { useEffect, useMemo } from 'react';

const baseMainNavItems: NavItem[] = [
    {
        title: 'Panel Principal',
        href: '/dashboard',
        icon: LayoutGrid,
    },
    {
        title: 'Control de Retransmisión',
        href: '/control',
        icon: TowerControl,
        isActive: false
    },
    {
        title: 'Videos de Respaldo',
        href: '/fallback',
        icon: PlayIcon,
    },
    {
        title: 'Control Remoto',
        href: '/streamingtool',
        icon: Video,
    },

];
const secondaryNavItems: NavItem[] = [
    {
        title: 'Configuración',
        href: '/configuracion',
        icon: Settings,
    },
]

const footerNavItems: NavItem[] = [
    /*     {
            title: 'Repository',
            href: 'https://github.com/laravel/react-starter-kit',
            icon: Folder,
        },
        {
            title: 'Documentation',
            href: 'https://laravel.com/docs/starter-kits#react',
            icon: BookOpen,
        }, */
];

export function AppSidebar() {
    const auth = usePage().props.auth as {
        user?: {
            isadmin?: boolean;
            licencia?: {
                videosfallback?: boolean;
                controlremoto?: boolean;
                retransmision?: boolean;
            };
        };
    };

    useEffect(() => {
        console.log(auth)
    }, [auth])
    const mainNavItems = useMemo(() => {
        const items = [...baseMainNavItems];

        if (auth.user && auth.user.isadmin) {
            const adminItem: NavItem = {
                title: 'Admin Panel',
                href: '/admin',
                icon: LayoutDashboard,
            };
            items.push(adminItem);
        }

        !auth.user?.licencia?.videosfallback ? items[2].locked = true : items[2].locked = false;
        !auth.user?.licencia?.controlremoto ? items[3].locked = true : items[3].locked = false;
        !auth.user?.licencia?.retransmision ? items[1].locked = true : items[1].locked = false;

        return items;
    }, [auth.user]);


    useEffect(() => {
        console.log('Main Navigation Items:', auth.user);
    }, [auth]);

    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href="/dashboard" className='flex' prefetch>
                            <div className='bg-white'>
                                <img src="/streamff-logo3.png" alt="App Logo" className="h-10 w-10" />
                            </div>
                                <div className="ml-1 grid flex-1 text-left text-sm">
                                    <span className="mb-0.5 truncate leading-tight font-semibold">{import.meta.env.VITE_APP_NAME || "Stream FF"}</span>
                                </div>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <NavMain items={mainNavItems} name="Plataforma" />
                <NavMain items={secondaryNavItems} name="Configuración" />
            </SidebarContent>

            <SidebarFooter>
                <NavFooter items={footerNavItems} className="mt-auto" />
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
