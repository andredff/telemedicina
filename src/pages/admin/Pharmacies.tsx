import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Store,
  Plus,
  Pencil,
  Trash2,
  Search,
  ChevronDown,
  ChevronUp,
  DollarSign,
} from 'lucide-react';

type Pharmacy = {
  id: string;
  name: string;
  logo_url: string | null;
  is_premium: boolean;
  commission_rate: number;
  monthly_fee: number;
  phone: string | null;
  email: string | null;
  active: boolean;
  created_at: string;
};

type PharmacyPrice = {
  id: string;
  pharmacy_id: string;
  medication_name: string;
  price: number;
  delivery_days: number;
  in_stock: boolean;
};

const emptyPharmacy: Omit<Pharmacy, 'id' | 'created_at'> = {
  name: '',
  logo_url: '',
  is_premium: false,
  commission_rate: 15,
  monthly_fee: 0,
  phone: '',
  email: '',
  active: true,
};

const emptyPrice: Omit<PharmacyPrice, 'id' | 'pharmacy_id'> = {
  medication_name: '',
  price: 0,
  delivery_days: 2,
  in_stock: true,
};

export default function Pharmacies() {
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<Pharmacy | null>(null);
  const [form, setForm] = useState(emptyPharmacy);
  const [saving, setSaving] = useState(false);

  // Prices management
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [prices, setPrices] = useState<PharmacyPrice[]>([]);
  const [pricesLoading, setPricesLoading] = useState(false);
  const [showPriceDialog, setShowPriceDialog] = useState(false);
  const [editingPrice, setEditingPrice] = useState<PharmacyPrice | null>(null);
  const [priceForm, setPriceForm] = useState(emptyPrice);
  const [savingPrice, setSavingPrice] = useState(false);

  useEffect(() => {
    fetchPharmacies();
  }, []);

  async function fetchPharmacies() {
    setLoading(true);
    const { data } = await supabase
      .from('pharmacies')
      .select('*')
      .order('name');
    setPharmacies((data as Pharmacy[]) ?? []);
    setLoading(false);
  }

  async function fetchPrices(pharmacyId: string) {
    setPricesLoading(true);
    const { data } = await supabase
      .from('pharmacy_prices')
      .select('*')
      .eq('pharmacy_id', pharmacyId)
      .order('medication_name');
    setPrices((data as PharmacyPrice[]) ?? []);
    setPricesLoading(false);
  }

  function openNew() {
    setEditing(null);
    setForm(emptyPharmacy);
    setShowDialog(true);
  }

  function openEdit(p: Pharmacy) {
    setEditing(p);
    setForm({
      name: p.name,
      logo_url: p.logo_url ?? '',
      is_premium: p.is_premium,
      commission_rate: p.commission_rate,
      monthly_fee: p.monthly_fee,
      phone: p.phone ?? '',
      email: p.email ?? '',
      active: p.active,
    });
    setShowDialog(true);
  }

  async function savePharmacy() {
    setSaving(true);
    const payload = {
      name: form.name,
      logo_url: form.logo_url || null,
      is_premium: form.is_premium,
      commission_rate: form.commission_rate,
      monthly_fee: form.monthly_fee,
      phone: form.phone || null,
      email: form.email || null,
      active: form.active,
      updated_at: new Date().toISOString(),
    };

    if (editing) {
      await supabase.from('pharmacies').update(payload).eq('id', editing.id);
    } else {
      await supabase.from('pharmacies').insert(payload);
    }

    setSaving(false);
    setShowDialog(false);
    fetchPharmacies();
  }

  async function deletePharmacy(id: string) {
    if (!confirm('Excluir esta farmácia?')) return;
    await supabase.from('pharmacies').delete().eq('id', id);
    fetchPharmacies();
  }

  async function toggleExpand(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
      setPrices([]);
    } else {
      setExpandedId(id);
      await fetchPrices(id);
    }
  }

  function openNewPrice(pharmacyId: string) {
    setEditingPrice(null);
    setPriceForm(emptyPrice);
    setShowPriceDialog(true);
  }

  function openEditPrice(p: PharmacyPrice) {
    setEditingPrice(p);
    setPriceForm({
      medication_name: p.medication_name,
      price: p.price,
      delivery_days: p.delivery_days,
      in_stock: p.in_stock,
    });
    setShowPriceDialog(true);
  }

  async function savePrice() {
    if (!expandedId) return;
    setSavingPrice(true);
    const payload = {
      pharmacy_id: expandedId,
      medication_name: priceForm.medication_name,
      price: priceForm.price,
      delivery_days: priceForm.delivery_days,
      in_stock: priceForm.in_stock,
      updated_at: new Date().toISOString(),
    };

    if (editingPrice) {
      await supabase.from('pharmacy_prices').update(payload).eq('id', editingPrice.id);
    } else {
      await supabase.from('pharmacy_prices').insert(payload);
    }

    setSavingPrice(false);
    setShowPriceDialog(false);
    fetchPrices(expandedId);
  }

  async function deletePrice(id: string) {
    if (!confirm('Excluir este preço?')) return;
    await supabase.from('pharmacy_prices').delete().eq('id', id);
    if (expandedId) fetchPrices(expandedId);
  }

  const filtered = pharmacies.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Store className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Farmácias Parceiras</h1>
        </div>
        <Button onClick={openNew} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Nova Farmácia
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar farmácia..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-gray-500 py-12">Nenhuma farmácia cadastrada.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Comissão</TableHead>
                  <TableHead>Mensalidade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((pharmacy) => (
                  <>
                    <TableRow key={pharmacy.id} className="cursor-pointer hover:bg-gray-50">
                      <TableCell className="font-medium">{pharmacy.name}</TableCell>
                      <TableCell>
                        {pharmacy.is_premium ? (
                          <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
                            Premium
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Padrão</Badge>
                        )}
                      </TableCell>
                      <TableCell>{pharmacy.commission_rate}%</TableCell>
                      <TableCell>
                        {pharmacy.monthly_fee > 0
                          ? `R$ ${pharmacy.monthly_fee.toFixed(2)}`
                          : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            pharmacy.active
                              ? 'bg-green-100 text-green-800 border-green-200'
                              : 'bg-gray-100 text-gray-600 border-gray-200'
                          }
                        >
                          {pharmacy.active ? 'Ativa' : 'Inativa'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleExpand(pharmacy.id)}
                            title="Gerenciar preços"
                          >
                            <DollarSign className="h-4 w-4" />
                            {expandedId === pharmacy.id ? (
                              <ChevronUp className="h-3 w-3 ml-1" />
                            ) : (
                              <ChevronDown className="h-3 w-3 ml-1" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(pharmacy)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-700"
                            onClick={() => deletePharmacy(pharmacy.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>

                    {expandedId === pharmacy.id && (
                      <TableRow key={`${pharmacy.id}-prices`}>
                        <TableCell colSpan={6} className="bg-gray-50 p-4">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <h3 className="font-semibold text-sm text-gray-700">
                                Tabela de Preços — {pharmacy.name}
                              </h3>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openNewPrice(pharmacy.id)}
                                className="flex items-center gap-1"
                              >
                                <Plus className="h-3 w-3" />
                                Adicionar Medicamento
                              </Button>
                            </div>

                            {pricesLoading ? (
                              <div className="flex justify-center py-4">
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
                              </div>
                            ) : prices.length === 0 ? (
                              <p className="text-sm text-gray-500 py-2">
                                Nenhum preço cadastrado para esta farmácia.
                              </p>
                            ) : (
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Medicamento</TableHead>
                                    <TableHead>Preço</TableHead>
                                    <TableHead>Prazo entrega</TableHead>
                                    <TableHead>Estoque</TableHead>
                                    <TableHead className="text-right">Ações</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {prices.map((price) => (
                                    <TableRow key={price.id}>
                                      <TableCell>{price.medication_name}</TableCell>
                                      <TableCell>R$ {price.price.toFixed(2)}</TableCell>
                                      <TableCell>{price.delivery_days} dias</TableCell>
                                      <TableCell>
                                        <Badge
                                          className={
                                            price.in_stock
                                              ? 'bg-green-100 text-green-800 border-green-200'
                                              : 'bg-red-100 text-red-800 border-red-200'
                                          }
                                        >
                                          {price.in_stock ? 'Em estoque' : 'Sem estoque'}
                                        </Badge>
                                      </TableCell>
                                      <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-2">
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => openEditPrice(price)}
                                          >
                                            <Pencil className="h-3 w-3" />
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-red-500 hover:text-red-700"
                                            onClick={() => deletePrice(price.id)}
                                          >
                                            <Trash2 className="h-3 w-3" />
                                          </Button>
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pharmacy Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Farmácia' : 'Nova Farmácia'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Nome *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Nome da farmácia"
              />
            </div>
            <div>
              <Label>URL do Logo</Label>
              <Input
                value={form.logo_url ?? ''}
                onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Comissão (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={form.commission_rate}
                  onChange={(e) =>
                    setForm({ ...form, commission_rate: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>
              <div>
                <Label>Mensalidade (R$)</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.monthly_fee}
                  onChange={(e) =>
                    setForm({ ...form, monthly_fee: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Telefone</Label>
                <Input
                  value={form.phone ?? ''}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="(11) 99999-9999"
                />
              </div>
              <div>
                <Label>E-mail</Label>
                <Input
                  value={form.email ?? ''}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="contato@farmacia.com"
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.is_premium}
                  onCheckedChange={(v) => setForm({ ...form, is_premium: v })}
                />
                <Label>Farmácia Premium</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.active}
                  onCheckedChange={(v) => setForm({ ...form, active: v })}
                />
                <Label>Ativa</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={savePharmacy} disabled={saving || !form.name}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Price Dialog */}
      <Dialog open={showPriceDialog} onOpenChange={setShowPriceDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {editingPrice ? 'Editar Preço' : 'Novo Preço'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Medicamento *</Label>
              <Input
                value={priceForm.medication_name}
                onChange={(e) =>
                  setPriceForm({ ...priceForm, medication_name: e.target.value })
                }
                placeholder="Nome do medicamento"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Preço (R$) *</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={priceForm.price}
                  onChange={(e) =>
                    setPriceForm({ ...priceForm, price: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>
              <div>
                <Label>Prazo (dias)</Label>
                <Input
                  type="number"
                  min={1}
                  value={priceForm.delivery_days}
                  onChange={(e) =>
                    setPriceForm({
                      ...priceForm,
                      delivery_days: parseInt(e.target.value) || 1,
                    })
                  }
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={priceForm.in_stock}
                onCheckedChange={(v) => setPriceForm({ ...priceForm, in_stock: v })}
              />
              <Label>Em estoque</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPriceDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={savePrice}
              disabled={savingPrice || !priceForm.medication_name || priceForm.price <= 0}
            >
              {savingPrice ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
