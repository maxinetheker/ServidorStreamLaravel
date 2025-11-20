import AppLayout from '@/layouts/app-layout';
import { Head, useForm, router } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useEffect, useState } from 'react';

export default function AdminUsers() {
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const { patch, processing } = useForm({});
    const [licenseModalOpen, setLicenseModalOpen] = useState(false);
    const [modalUser, setModalUser] = useState<any | null>(null);
    const [modalDate, setModalDate] = useState('');
    const [modalSaving, setModalSaving] = useState(false);

    const handleApiError = (err: any) => {
        const msg = err?.response?.data?.message ?? err?.message ?? 'Error';
        toast.error(msg);
    };

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/users');
            const json = await res.json();
            setUsers(json.users || []);
        } catch (e) {
            console.error(e);
            toast.error('Error cargando usuarios');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const toggleActive = (id: number) => {
        setLoading(true);
        patch(`/api/admin/users/${id}/toggle`, {
            preserveState: true,
            onSuccess: () => {
                toast.success('Estado actualizado');
                fetchUsers();
            },
            onError: () => {
                toast.error('Error actualizando estado');
                setLoading(false);
            }
        });
    };

    const activateLicense = (id: number) => {
        // If license already active -> deactivate immediately
        const u = users.find((x) => x.id === id);
        const isActive = !!u?.licencia?.active;
        if (isActive) {
            router.patch(`/api/admin/users/${id}/license/toggle`, {}, {
                preserveState: true,
                onSuccess: () => { toast.success('Licencia desactivada'); fetchUsers(); },
                onError: handleApiError,
            });
            return;
        }

        // Otherwise open modal to select vencimiento when activating license
        setModalUser(u || null);
        setModalDate(u?.licencia?.vencimiento ? u.licencia.vencimiento.split('T')[0] : '');
        setLicenseModalOpen(true);
    };

    const closeLicenseModal = () => {
        setLicenseModalOpen(false);
        setModalUser(null);
        setModalDate('');
    };

    const saveLicenseModal = () => {
        if (!modalUser) return;
        setModalSaving(true);
        router.patch(`/api/admin/users/${modalUser.id}/license/toggle`, { vencimiento: modalDate || null }, {
            preserveState: true,
            onSuccess: () => {
                toast.success('Licencia actualizada');
                fetchUsers();
                closeLicenseModal();
                setModalSaving(false);
            },
            onError: (e: any) => {
                console.error(e);
                handleApiError(e);
                setModalSaving(false);
            }
        });
    };

    const isLicenseExpired = (venc: string | undefined | null) => {
        if (!venc) return false;
        try {
            const d = new Date(venc);
            d.setHours(0,0,0,0);
            const today = new Date();
            today.setHours(0,0,0,0);
            return d < today;
        } catch (e) {
            return false;
        }
    };

    return (
        <AppLayout breadcrumbs={[{ title: 'Admin', href: '/admin' }, { title: 'Users', href: '/admin/users' }]}>
            <Head title="Admin - Users" />

            <div className="p-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Administrar Usuarios</CardTitle>
                        <CardDescription>Activa/desactiva usuarios y licencias</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-auto">
                            <table className="w-full table-auto text-sm">
                                <thead>
                                    <tr className="text-left">
                                        <th className="px-2 py-2">ID</th>
                                        <th className="px-2 py-2">Nombre</th>
                                        <th className="px-2 py-2">Email</th>
                                        <th className="px-2 py-2">Activo</th>
                                        <th className="px-2 py-2">Licencia</th>
                                        <th className="px-2 py-2">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map((u) => (
                                        <tr key={u.id} className="border-t">
                                            <td className="px-2 py-2">{u.id}</td>
                                            <td className="px-2 py-2">{u.name}</td>
                                            <td className="px-2 py-2">{u.email}</td>
                                            <td className="px-2 py-2">
                                                <Badge variant={u.active ? 'default' : 'destructive'}>
                                                    {u.active ? 'Activo' : 'Inactivo'}
                                                </Badge>
                                            </td>
                                            <td className="px-2 py-2">
                                                <div className="text-xs">
                                                    {(() => {
                                                        const expired = isLicenseExpired(u.licencia?.vencimiento);
                                                        return (
                                                            <>
                                                                <div>Estado: <span className={u.licencia?.active ? 'text-green-600' : (expired ? 'text-red-600' : 'text-gray-500')}>{u.licencia?.active ? 'Activa' : (expired ? 'Vencida' : 'Inactiva')}</span></div>
                                                                <div>Tipo: <span className="font-medium">{u.licencia?.tipo || 'free'}</span></div>
                                                                <div>Vencimiento: <span className="font-medium">{u.licencia?.vencimiento ? new Date(u.licencia.vencimiento).toLocaleDateString() : '—'}</span></div>
                                                            </>
                                                        );
                                                    })()}
                                                </div>
                                            </td>
                                            <td className="px-2 py-2">
                                                <div className="flex gap-2 flex-wrap items-center">
                                                    <Button size="sm" onClick={() => toggleActive(u.id)} disabled={loading || processing}>{u.active ? 'Desactivar' : 'Activar'}</Button>
                                                    <Button size="sm" onClick={() => activateLicense(u.id)} disabled={loading || processing}>{u.licencia?.active ? 'Desactivar Licencia' : 'Activar Licencia'}</Button>

                                                    <div className="flex items-center gap-2">
                                                        <label className="text-xs">Gestionar características:</label>
                                                        {(() => {
                                                            const expired = isLicenseExpired(u.licencia?.vencimiento);
                                                            return (
                                                                <select className="border rounded px-2 py-1 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400" onChange={(e) => {
                                                            const feat = e.target.value;
                                                            if (!feat) return;
                                                            const currently = !!u.licencia?.[feat];
                                                                router.patch(`/api/admin/users/${u.id}/license`, { feature: feat, active: !currently }, {
                                                                    preserveState: true,
                                                                    onSuccess: () => { toast.success(!currently ? `${feat} activada` : `${feat} desactivada`); fetchUsers(); },
                                                                    onError: handleApiError
                                                                });
                                                            // reset select
                                                            e.target.value = '';
                                                                }} disabled={!u.licencia?.active || loading || processing || expired} defaultValue="">
                                                            <option value="">Seleccionar...</option>
                                                            <option value="retransmision">Retransmisión {u.licencia?.retransmision ? '✓' : ''}</option>
                                                            <option value="controlremoto">Control Remoto {u.licencia?.controlremoto ? '✓' : ''}</option>
                                                            <option value="videosfallback">Videos Fallback {u.licencia?.videosfallback ? '✓' : ''}</option>
                                                                </select>
                                                            );
                                                        })()}
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            </div>
                {/* Simple modal for selecting vencimiento */}
                {licenseModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 p-4 rounded shadow w-full max-w-md">
                    <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">Seleccionar fecha de vencimiento</h3>
                    <p className="text-sm mb-3 text-gray-600 dark:text-gray-300">La fecha aplica a la activación de la licencia.</p>
                            <input type="date" className="w-full border rounded p-2 mb-4 bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-400" value={modalDate} onChange={(e) => setModalDate(e.target.value)} />
                            <div className="flex justify-end gap-2">
                                <Button onClick={closeLicenseModal} disabled={modalSaving}>Cancelar</Button>
                                <Button onClick={saveLicenseModal} disabled={modalSaving}>{modalSaving ? 'Guardando...' : 'Guardar'}</Button>
                            </div>
                        </div>
                    </div>
                )}
        </AppLayout>
    );
}
