import AppLayout from '@/layouts/app-layout';
import { Head, Link } from '@inertiajs/react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function AdminIndex() {
    return (
        <AppLayout breadcrumbs={[{ title: 'Admin', href: '/admin' }]}>
            <Head title="Admin" />
            <div className="p-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Admin Panel</CardTitle>
                        <CardDescription>Herramientas administrativas</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            <Button asChild>
                                <Link href="/admin/users">Administrar Usuarios</Link>
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}
