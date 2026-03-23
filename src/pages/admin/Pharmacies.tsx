import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Store, Plus, Pencil, Trash2, Search, ChevronDown, ChevronUp,
  DollarSign, Phone, Mail, MapPin, Building2,
} from 'lucide-react';
import { PharmacyFull } from '@/types/inventory';

type PharmacyPrice = {
  id: string;
  pharmacy_id: string;
  medication_name: string;
  price: number;
  delivery_days: number;
  in_stock: boolean;
};

const emptyForm: Omit<PharmacyFull, 'id' | 'created_at' | 'updated_at'> = {
  name: '', razao_social: '', cnpj: '', logo_url: '',
  is_premium: false, commission_rate: 15, monthly_fee: 0,
  phone: '', whatsapp: '', email: '',
  address: '', city: '', state: '', zip_code: '',
  active: true,
};

function formatCNPJ(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

export default function Pharmacies() {
  const { toast } = useToast();
  const [pharmacies, setPharmacies] = useState<PharmacyFull[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<PharmacyFull | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  // Prices
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [prices, setPrices] = useState<PharmacyPrice[]>([]);
  const [pricesLoading, setPricesLoading] = useState(false);
  const [showPriceDialog, setShowPriceDialog] = useState(false);
  const [editingPrice, setEditingPrice] = useState<PharmacyPrice | null>(null);
  const [priceForm, setPriceForm] = useState({ medication_name: '', price: 0, delivery_days: 2, in_stock: true });
  const [savingPrice, setSavingPrice] = useState(false);

  useEffect(() => { fetchPharmacies(); }, []);

  async function fetchPharmacies() {
    setLoading(true);
    const { data } = await supabase.from('pharmacies').select('*').order('name');
    setPharmacies((data as PharmacyFull[]) ?? []);
    setLoading(false);
  }

  async function fetchPrices(pharmacyId: string) {
    setPricesLoading(true);
    const { data } = await supabase
      .from('pharmacy_prices').select('*').eq('pharmacy_id', pharmacyId).order('medication_name');
    setPrices((data as PharmacyPrice[]) ?? []);
    setPricesLoading(false);
  }

  function openNew() {
    setEditing(null);
    setForm(emptyForm);
    setShowDialog(true);
  }

  function openEdit(p: PharmacyFull) {
    setEditing(p);
    setForm({
      name: p.name, razao_social: p.razao_social ?? '', cnpj: p.cnpj ?? '',
      logo_url: p.logo_url ?? '', is_premium: p.is_premium,
      commission_rate: p.commission_rate, monthly_fee: p.monthly_fee,
      phone: p.phone ?? '', whatsapp: p.whatsapp ?? '', email: p.email ?? '',
      address: p.address ?? '', city: p.city ?? '', state: p.state ?? '',
      zip_code: p.zip_code ?? '', active: p.active,
    });
    setShowDialog(true);
  }

  async function savePharmacy() {
    if (!form.name.trim()) { toast({ title: 'Nome obrigatório', variant: 'destructive' }); return; }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      razao_social: form.razao_social || null,
      cnpj: form.cnpj || null,
      logo_url: form.logo_url || null,
      is_premium: form.is_premium,
      commission_rate: form.commission_rate,
      monthly_fee: form.monthly_fee,
      phone: form.phone || null,
      whatsapp: form.whatsapp || null,
      email: form.email || null,
      address: form.address || null,
      city: form.city || null,
      state: form.state || null,
      zip_code: form.zip_code || null,
      active: form.active,
      updated_at: new Date().toISOString(),
    };
    if (editing) {
      await supabase.from('pharmacies').update(payload).eq('id', editing.id);
      toast({ title: 'Farmácia atualizada' });
    } else {
      await supabase.from('pharmacies').insert(payload);
      toast({ title: 'Farmácia cadastrada' });
    }
    setSaving(false);
    setShowDialog(false);
    fetchPharmacies();
  }

  async function deletePharmacy(id: string) {
    if (!confirm('Excluir esta farmácia e todos os seus dados?')) return;
    await supabase.from('pharmacies').delete().eq('id', id);
    toast({ title: 'Farmácia excluída' });
    fetchPharmacies();
  }

  async function toggleExpand(id: string) {
    if (expandedId === id) { setExpandedId(null); setPrices([]); }
    else { setExpandedId(id); await fetchPrices(id); }
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
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.cnpj ?? '').includes(search)
  );

  const f = (field: keyof typeof emptyForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Store className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Farmácias Parceiras</h1>
            <p className="text-sm text-gray-500">{pharmacies.length} farmácia{pharmacies.length !== 1 ? 's' : ''} cadastrada{pharmacies.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="h-4 w-4" />Nova Farmácia
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar por nome ou CNPJ..."
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
            <p className="text-center text-gray-500 py-12">Nenhuma farmácia encontrada.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome / Razão Social</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((pharmacy) => (
                  <>
                    <TableRow key={pharmacy.id}>
                      <TableCell>
                        <p className="font-medium">{pharmacy.name}</p>
                        {pharmacy.razao_social && (
                          <p className="text-xs text-gray-500">{pharmacy.razao_social}</p>
                        )}
                        {pharmacy.city && (
                          <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                            <MapPin className="h-3 w-3" />
                            {pharmacy.city}{pharmacy.state ? `/${pharmacy.state}` : ''}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{pharmacy.cnpj ?? '—'}</TableCell>
                      <TableCell>
                        {pharmacy.phone && (
                          <p className="text-xs flex items-center gap-1">
                            <Phone className="h-3 w-3 text-gray-400" />{pharmacy.phone}
                          </p>
                        )}
                        {pharmacy.email && (
                          <p className="text-xs flex items-center gap-1 mt-0.5">
                            <Mail className="h-3 w-3 text-gray-400" />{pharmacy.email}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        {pharmacy.is_premium ? (
                          <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Premium</Badge>
                        ) : (
                          <Badge variant="secondary">Padrão</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={pharmacy.active
                          ? 'bg-green-100 text-green-800 border-green-200'
                          : 'bg-gray-100 text-gray-600 border-gray-200'}>
                          {pharmacy.active ? 'Ativa' : 'Inativa'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => toggleExpand(pharmacy.id)} title="Preços">
                            <DollarSign className="h-4 w-4" />
                            {expandedId === pharmacy.id ? <ChevronUp className="h-3 w-3 ml-0.5" /> : <ChevronDown className="h-3 w-3 ml-0.5" />}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openEdit(pharmacy)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => deletePharmacy(pharmacy.id)}>
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
                              <h3 className="font-semibold text-sm text-gray-700">Preços — {pharmacy.name}</h3>
                              <Button size="sm" variant="outline" onClick={() => { setEditingPrice(null); setPriceForm({ medication_name: '', price: 0, delivery_days: 2, in_stock: true }); setShowPriceDialog(true); }} className="gap-1">
                                <Plus className="h-3 w-3" />Adicionar
                              </Button>
                            </div>
                            {pricesLoading ? (
                              <div className="flex justify-center py-4">
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
                              </div>
                            ) : prices.length === 0 ? (
                              <p className="text-sm text-gray-500 py-2">Nenhum preço cadastrado.</p>
                            ) : (
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Medicamento</TableHead>
                                    <TableHead>Preço</TableHead>
                                    <TableHead>Prazo</TableHead>
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
                                        <Badge className={price.in_stock ? 'bg-green-100 text-green-800 border-green-200' : 'bg-red-100 text-red-800 border-red-200'}>
                                          {price.in_stock ? 'Em estoque' : 'Sem estoque'}
                                        </Badge>
                                      </TableCell>
                                      <TableCell className="text-right">
                                        <div className="flex justify-end gap-1">
                                          <Button variant="ghost" size="sm" onClick={() => { setEditingPrice(price); setPriceForm({ medication_name: price.medication_name, price: price.price, delivery_days: price.delivery_days, in_stock: price.in_stock }); setShowPriceDialog(true); }}>
                                            <Pencil className="h-3 w-3" />
                                          </Button>
                                          <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => deletePrice(price.id)}>
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

      {/* Pharmacy dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {editing ? 'Editar Farmácia' : 'Nova Farmácia'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Identity */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Identificação</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label>Nome Fantasia *</Label>
                  <Input value={form.name} onChange={f('name')} placeholder="Ex: Farmácia Saúde Total" />
                </div>
                <div className="col-span-2">
                  <Label>Razão Social</Label>
                  <Input value={form.razao_social ?? ''} onChange={f('razao_social')} placeholder="Ex: Farmácia Saúde Total LTDA" />
                </div>
                <div>
                  <Label>CNPJ</Label>
                  <Input
                    value={form.cnpj ?? ''}
                    onChange={(e) => setForm((p) => ({ ...p, cnpj: formatCNPJ(e.target.value) }))}
                    placeholder="00.000.000/0000-00"
                    maxLength={18}
                  />
                </div>
                <div>
                  <Label>URL do Logo</Label>
                  <Input value={form.logo_url ?? ''} onChange={f('logo_url')} placeholder="https://..." />
                </div>
              </div>
            </div>

            {/* Address */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Endereço</p>
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-3">
                  <Label>Endereço</Label>
                  <Input value={form.address ?? ''} onChange={f('address')} placeholder="Rua, número, complemento" />
                </div>
                <div className="col-span-2">
                  <Label>Cidade</Label>
                  <Input value={form.city ?? ''} onChange={f('city')} placeholder="Brasília" />
                </div>
                <div>
                  <Label>UF</Label>
                  <Input value={form.state ?? ''} onChange={(e) => setForm((p) => ({ ...p, state: e.target.value.toUpperCase().slice(0, 2) }))} placeholder="DF" maxLength={2} />
                </div>
                <div>
                  <Label>CEP</Label>
                  <Input value={form.zip_code ?? ''} onChange={f('zip_code')} placeholder="00000-000" />
                </div>
              </div>
            </div>

            {/* Contact */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Contato</p>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Telefone</Label>
                  <Input value={form.phone ?? ''} onChange={f('phone')} placeholder="(61) 3333-4444" />
                </div>
                <div>
                  <Label>WhatsApp</Label>
                  <Input value={form.whatsapp ?? ''} onChange={f('whatsapp')} placeholder="(61) 99999-9999" />
                </div>
                <div>
                  <Label>E-mail</Label>
                  <Input value={form.email ?? ''} onChange={f('email')} placeholder="contato@farmacia.com" type="email" />
                </div>
              </div>
            </div>

            {/* Commercial */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Comercial</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Comissão (%)</Label>
                  <Input type="number" min={0} max={100} step={0.5} value={form.commission_rate}
                    onChange={(e) => setForm((p) => ({ ...p, commission_rate: parseFloat(e.target.value) || 0 }))} />
                </div>
                <div>
                  <Label>Mensalidade (R$)</Label>
                  <Input type="number" min={0} step={0.01} value={form.monthly_fee}
                    onChange={(e) => setForm((p) => ({ ...p, monthly_fee: parseFloat(e.target.value) || 0 }))} />
                </div>
              </div>
              <div className="flex items-center justify-between mt-4">
                <div className="flex items-center gap-2">
                  <Switch checked={form.is_premium} onCheckedChange={(v) => setForm((p) => ({ ...p, is_premium: v }))} />
                  <Label>Farmácia Premium</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={form.active} onCheckedChange={(v) => setForm((p) => ({ ...p, active: v }))} />
                  <Label>Ativa</Label>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
            <Button onClick={savePharmacy} disabled={saving || !form.name}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Price dialog */}
      <Dialog open={showPriceDialog} onOpenChange={setShowPriceDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingPrice ? 'Editar Preço' : 'Novo Preço'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Medicamento *</Label>
              <Input value={priceForm.medication_name} onChange={(e) => setPriceForm((p) => ({ ...p, medication_name: e.target.value }))} placeholder="Nome do medicamento" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Preço (R$) *</Label>
                <Input type="number" min={0} step={0.01} value={priceForm.price}
                  onChange={(e) => setPriceForm((p) => ({ ...p, price: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div>
                <Label>Prazo (dias)</Label>
                <Input type="number" min={1} value={priceForm.delivery_days}
                  onChange={(e) => setPriceForm((p) => ({ ...p, delivery_days: parseInt(e.target.value) || 1 }))} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={priceForm.in_stock} onCheckedChange={(v) => setPriceForm((p) => ({ ...p, in_stock: v }))} />
              <Label>Em estoque</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPriceDialog(false)}>Cancelar</Button>
            <Button onClick={savePrice} disabled={savingPrice || !priceForm.medication_name || priceForm.price <= 0}>
              {savingPrice ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
