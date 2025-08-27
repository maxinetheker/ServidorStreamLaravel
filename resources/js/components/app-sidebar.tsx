import { NavFooter } from '@/components/nav-footer';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { type NavItem } from '@/types';
import { Link } from '@inertiajs/react';
import { AlignVerticalDistributeStartIcon, BookOpen, Folder, LayoutGrid, PlayIcon, Settings, TowerControl, Video } from 'lucide-react';
import AppLogo from './app-logo';

const mainNavItems: NavItem[] = [
    {
        title: 'Panel Principal',
        href: '/dashboard',
        icon: LayoutGrid,
    },
    {
        title: 'Control de Retransmisión',
        href: '/control',
        icon: TowerControl,
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
    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href="/dashboard" prefetch>
                                <AppLogo />
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
