import { SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { type NavItem } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import { Lock } from 'lucide-react';

export function NavMain({ items = [], name }: { items: NavItem[]; name: string }) {
    const page = usePage();
    return (
        <SidebarGroup className="px-2 py-0">
            <SidebarGroupLabel>{name}</SidebarGroupLabel>
            <SidebarMenu>
                {items.map((item) => (
                    <SidebarMenuItem key={item.title}>
                            <SidebarMenuButton asChild isActive={page.url.startsWith(item.href)} tooltip={{ children: item.title }}>
                                <Link
                                    href={item.href}
                                    onClick={(e) => {
                                        if (item.locked) {
                                            e.preventDefault();
                                            e.stopPropagation();
                                        }
                                    }}
                                    aria-disabled={item.locked}
                                    className={item.locked ? 'pointer-events-none opacity-50' : undefined}
                                >
                                    {item.icon && <item.icon />}
                                    <span>{item.title}</span>
                                    {item.locked && <Lock className='absolute right-2 top-1/2 transform -translate-y-1/2' />}
                                </Link>
                            </SidebarMenuButton>
                    </SidebarMenuItem>
                ))}
            </SidebarMenu>
        </SidebarGroup>
    );
}
