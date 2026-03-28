import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { AdminQueries } from '@/integrations/supabase/adminClient';
import { supabase } from '@/integrations/supabase/client';
import { logger } from "@/lib/logger";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Search, Plus, Edit, Trash2, BookOpen, Newspaper, Pen, Eye, Loader2, ArrowLeft, ImagePlus, X, Replace } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

const RichTextEditor = lazy(() => import('@/components/admin/RichTextEditor'));

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  category: string;
  status: string;
  author: string;
  author_id?: string;
  created_at: string;
  published_at?: string;
  views: number;
  content?: string;
  excerpt?: string;
  featured_image?: string | null;
}

type ViewMode = 'list' | 'editor';

export default function AdminContent() {
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editingPost, setEditingPost] = useState<Partial<BlogPost> | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [uploadingCover, setUploadingCover] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const { data, error } = await AdminQueries.getAllBlogPosts();

      if (error) throw error;

      const formattedPosts = (data || []).map((post: Record<string, unknown>) => ({
        id: post.id as string,
        title: post.title as string,
        slug: post.slug as string,
        category: post.category as string,
        status: post.status as string,
        author: (post.author as string) || 'Admin',
        author_id: post.author_id as string,
        created_at: post.created_at as string,
        published_at: post.published_at as string,
        views: (post.views as number) || 0,
        content: post.content as string,
        excerpt: post.excerpt as string,
        featured_image: (post.featured_image as string) || null,
      }));

      setBlogPosts(formattedPosts);
    } catch (error) {
      logger.error('Error fetching blog posts:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao carregar posts',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  const filteredPosts = blogPosts.filter(post => {
    const matchesSearch = post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         post.author.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         post.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || post.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleEditPost = (post: BlogPost) => {
    setEditingPost({ ...post });
    setViewMode('editor');
  };

  const handleNewPost = () => {
    setEditingPost(buildEmptyPost());
    setViewMode('editor');
  };

  const handleBackToList = () => {
    setViewMode('list');
    setEditingPost(null);
  };

  const generateSlug = (title: string): string => {
    return title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const handleSavePost = async () => {
    if (!editingPost || !editingPost.title || !editingPost.category) {
      toast({
        title: 'Erro',
        description: 'Preencha todos os campos obrigatórios',
        variant: 'destructive'
      });
      return;
    }

    setSaving(true);
    try {
      const slug = editingPost.slug || generateSlug(editingPost.title);

      if (editingPost.id) {
        const { error } = await AdminQueries.updateBlogPost(editingPost.id, {
          title: editingPost.title,
          slug,
          content: editingPost.content,
          excerpt: editingPost.excerpt,
          category: editingPost.category,
          status: editingPost.status,
          featured_image: editingPost.featured_image ?? undefined,
          published_at: editingPost.status === 'published' ? new Date().toISOString() : undefined,
        });

        if (error) throw error;

        toast({
          title: 'Sucesso',
          description: 'Post atualizado com sucesso'
        });
      } else {
        const { error } = await AdminQueries.createBlogPost({
          title: editingPost.title,
          slug,
          content: editingPost.content,
          excerpt: editingPost.excerpt,
          category: editingPost.category,
          status: editingPost.status || 'draft',
          featured_image: editingPost.featured_image ?? undefined,
        });

        if (error) throw error;

        toast({
          title: 'Sucesso',
          description: 'Novo post criado com sucesso'
        });
      }

      setViewMode('list');
      setEditingPost(null);
      fetchPosts();
    } catch (error) {
      logger.error('Error saving post:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao salvar post',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePost = async (postId: string) => {
    try {
      const { error } = await AdminQueries.deleteBlogPost(postId);

      if (error) throw error;

      setBlogPosts(blogPosts.filter(post => post.id !== postId));
      toast({
        title: 'Sucesso',
        description: 'Post excluído com sucesso'
      });
    } catch (error) {
      logger.error('Error deleting post:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao excluir post',
        variant: 'destructive'
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      published: { text: 'Publicado', color: 'bg-green-100 text-green-800', dot: 'bg-green-500' },
      draft: { text: 'Rascunho', color: 'bg-gray-100 text-gray-800', dot: 'bg-gray-500' },
      scheduled: { text: 'Agendado', color: 'bg-blue-100 text-blue-800', dot: 'bg-blue-500' }
    };

    const config = statusConfig[status as keyof typeof statusConfig] ||
                   statusConfig.draft;

    return (
      <div className={`flex items-center gap-2 px-2 py-1 rounded-full text-sm ${config.color}`}>
        <div className={`h-2 w-2 rounded-full ${config.dot}`}></div>
        {config.text}
      </div>
    );
  };

  const buildEmptyPost = (): Partial<BlogPost> => ({
    title: '',
    slug: '',
    category: '',
    status: 'draft',
    content: '',
    excerpt: '',
    featured_image: null,
  });

  const handleCoverUpload = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Erro', description: 'Selecione um arquivo de imagem válido (JPG, PNG, WebP)', variant: 'destructive' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Erro', description: 'A imagem deve ter no máximo 5MB', variant: 'destructive' });
      return;
    }

    setUploadingCover(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `blog-covers/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('blog-content')
        .upload(filePath, file, { cacheControl: '3600', upsert: false });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('blog-content')
        .getPublicUrl(filePath);

      if (urlData.publicUrl) {
        setEditingPost(prev => prev ? { ...prev, featured_image: urlData.publicUrl } : null);
        toast({ title: 'Sucesso', description: 'Imagem de capa carregada' });
      }
    } catch (error) {
      logger.error('Error uploading cover image:', error);
      toast({ title: 'Erro', description: 'Falha ao fazer upload da imagem', variant: 'destructive' });
    } finally {
      setUploadingCover(false);
    }
  }, []);

  const handleCoverFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleCoverUpload(file);
    e.target.value = '';
  }, [handleCoverUpload]);

  const handleRemoveCover = () => {
    setEditingPost(prev => prev ? { ...prev, featured_image: null } : null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // ==========================================
  // EDITOR VIEW (full-page)
  // ==========================================
  if (viewMode === 'editor' && editingPost) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={handleBackToList}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Voltar
            </Button>
            <div>
              <h1 className="text-2xl font-bold">
                {editingPost.id ? 'Editar Post' : 'Novo Post'}
              </h1>
              <p className="text-gray-500 text-sm">
                {editingPost.id ? 'Modifique o conteúdo do post' : 'Crie um novo artigo para o blog'}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleBackToList}>
              Cancelar
            </Button>
            <Button onClick={handleSavePost} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar Post'
              )}
            </Button>
          </div>
        </div>

        {/* Post metadata */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Título *</label>
            <Input
              value={editingPost.title || ''}
              onChange={(e) => setEditingPost({ ...editingPost, title: e.target.value })}
              placeholder="Título do post"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Categoria *</label>
            <Select
              value={editingPost.category || ''}
              onValueChange={(value) => setEditingPost({ ...editingPost, category: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Saúde Mental">Saúde Mental</SelectItem>
                <SelectItem value="Telemedicina">Telemedicina</SelectItem>
                <SelectItem value="Nutrição">Nutrição</SelectItem>
                <SelectItem value="Exercícios">Exercícios</SelectItem>
                <SelectItem value="Prevenção">Prevenção</SelectItem>
                <SelectItem value="Bem-estar">Bem-estar</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Status</label>
            <Select
              value={editingPost.status || 'draft'}
              onValueChange={(value) => setEditingPost({ ...editingPost, status: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Rascunho</SelectItem>
                <SelectItem value="published">Publicado</SelectItem>
                <SelectItem value="archived">Arquivado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Excerpt */}
        <div>
          <label className="block text-sm font-medium mb-1.5">Resumo</label>
          <Input
            value={editingPost.excerpt || ''}
            onChange={(e) => setEditingPost({ ...editingPost, excerpt: e.target.value })}
            placeholder="Breve descrição do post (exibido na listagem do blog)"
          />
        </div>

        {/* Featured Image (Cover) - hidden for now
        <div>
          <label className="block text-sm font-medium mb-1.5">Imagem de Capa</label>
          {editingPost.featured_image ? (
            <div className="border rounded-lg overflow-hidden bg-gray-50">
              <div className="relative aspect-video max-h-[300px] overflow-hidden">
                <img
                  src={editingPost.featured_image}
                  alt="Imagem de capa"
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-2 right-2 flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="bg-white/90 hover:bg-white shadow-sm"
                    onClick={() => coverInputRef.current?.click()}
                    disabled={uploadingCover}
                  >
                    {uploadingCover ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Replace className="h-4 w-4 mr-1" />
                        Alterar
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="bg-white/90 hover:bg-red-50 text-red-600 hover:text-red-700 shadow-sm"
                    onClick={handleRemoveCover}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Remover
                  </Button>
                </div>
              </div>
              <div className="px-3 py-2 text-xs text-gray-500 border-t">
                Proporção recomendada: 16:9 &middot; Tamanho máximo: 5MB
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => coverInputRef.current?.click()}
              disabled={uploadingCover}
              className="w-full border-2 border-dashed border-gray-300 rounded-lg p-8 flex flex-col items-center justify-center gap-3 hover:border-orange-400 hover:bg-orange-50/50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploadingCover ? (
                <>
                  <Loader2 className="h-8 w-8 text-gray-400 animate-spin" />
                  <span className="text-sm text-gray-500">Fazendo upload...</span>
                </>
              ) : (
                <>
                  <ImagePlus className="h-8 w-8 text-gray-400" />
                  <div className="text-center">
                    <span className="text-sm font-medium text-gray-700">Clique para adicionar imagem de capa</span>
                    <p className="text-xs text-gray-500 mt-1">
                      JPG, PNG ou WebP &middot; Máx. 5MB &middot; Proporção recomendada: 16:9
                    </p>
                  </div>
                </>
              )}
            </button>
          )}
          <input
            ref={coverInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleCoverFileSelect}
          />
        </div>
        */}

        {/* Rich Text Editor */}
        <div>
          <label className="block text-sm font-medium mb-1.5">Conteúdo</label>
          <Suspense fallback={
            <div className="border rounded-lg flex items-center justify-center h-[400px]">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          }>
            <RichTextEditor
              content={editingPost.content || ''}
              onChange={(html) => setEditingPost({ ...editingPost, content: html })}
              placeholder="Escreva o conteúdo do post aqui..."
            />
          </Suspense>
        </div>

        {/* Bottom save bar */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={handleBackToList}>
            Cancelar
          </Button>
          <Button onClick={handleSavePost} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar Post'
            )}
          </Button>
        </div>
      </div>
    );
  }

  // ==========================================
  // LIST VIEW
  // ==========================================
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Gerenciamento de Conteúdo</h1>
        <p className="text-gray-600">Gerencie artigos do blog e páginas informativas</p>
      </div>

      {/* Controls */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar posts por título, autor ou categoria..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filtrar por status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="published">Publicados</SelectItem>
            <SelectItem value="draft">Rascunhos</SelectItem>
            <SelectItem value="scheduled">Agendados</SelectItem>
          </SelectContent>
        </Select>

        <Button onClick={handleNewPost}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Post
        </Button>
      </div>

      {/* Blog Posts Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Título</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Autor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Visualizações</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredPosts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-4">
                  Nenhum post encontrado
                </TableCell>
              </TableRow>
            ) : (
              filteredPosts.map((post) => (
                <TableRow key={post.id}>
                  <TableCell>
                    <div className="font-medium">{post.title}</div>
                    <div className="text-sm text-gray-500">
                      {new Date(post.created_at).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric'
                      })}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className={`flex items-center gap-2 px-2 py-1 rounded-full text-sm bg-blue-100 text-blue-800`}>
                      <Newspaper className="h-4 w-4" />
                      {post.category}
                    </div>
                  </TableCell>
                  <TableCell>{post.author}</TableCell>
                  <TableCell>{getStatusBadge(post.status)}</TableCell>
                  <TableCell>{post.views}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditPost(post)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-500 hover:text-red-700"
                        onClick={() => handleDeletePost(post.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="flex-1 min-w-[200px]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Posts</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{blogPosts.length}</div>
          </CardContent>
        </Card>

        <Card className="flex-1 min-w-[200px]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Publicados</CardTitle>
            <Pen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{blogPosts.filter(p => p.status === 'published').length}</div>
          </CardContent>
        </Card>

        <Card className="flex-1 min-w-[200px]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Visualizações Totais</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{blogPosts.reduce((sum, post) => sum + post.views, 0)}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
