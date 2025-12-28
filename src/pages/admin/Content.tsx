import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { Search, Plus, Edit, Trash2, BookOpen, Newspaper, Pen } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

export default function AdminContent() {
  const [blogPosts, setBlogPosts] = useState([
    {
      id: '1',
      title: 'Como cuidar da saúde mental durante a pandemia',
      category: 'Saúde Mental',
      status: 'published',
      author: 'Dr. Carlos Silva',
      date: '2023-05-15',
      views: 1245
    },
    {
      id: '2',
      title: 'Os benefícios da telemedicina para pacientes crônicos',
      category: 'Telemedicina',
      status: 'draft',
      author: 'Dra. Ana Souza',
      date: '2023-06-22',
      views: 872
    },
    {
      id: '3',
      title: 'Dicas para uma alimentação saudável no inverno',
      category: 'Nutrição',
      status: 'published',
      author: 'Nut. Maria Oliveira',
      date: '2023-07-10',
      views: 1563
    }
  ]);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editingPost, setEditingPost] = useState<{ id: number; title: string; author: string; date: string; content: string; status: string; views: number } | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const filteredPosts = blogPosts.filter(post => {
    const matchesSearch = post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         post.author.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         post.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || post.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleEditPost = (post: { id: number; title: string; author: string; date: string; content: string; status: string; views: number }) => {
    setEditingPost(post);
    setIsDialogOpen(true);
  };

  const handleSavePost = () => {
    if (!editingPost) return;
    
    if (editingPost.id) {
      // Update existing post
      setBlogPosts(blogPosts.map(post => 
        post.id === editingPost.id ? editingPost : post
      ));
      toast({
        title: 'Sucesso',
        description: 'Post atualizado com sucesso'
      });
    } else {
      // Add new post
      const newPost = {
        ...editingPost,
        id: (blogPosts.length + 1).toString(),
        date: new Date().toISOString().split('T')[0],
        views: 0
      };
      setBlogPosts([...blogPosts, newPost]);
      toast({
        title: 'Sucesso',
        description: 'Novo post criado com sucesso'
      });
    }
    
    setIsDialogOpen(false);
  };

  const handleDeletePost = (postId: string) => {
    setBlogPosts(blogPosts.filter(post => post.id !== postId));
    toast({
      title: 'Sucesso',
      description: 'Post excluído com sucesso'
    });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      published: { text: 'Publicado', color: 'bg-green-100 text-green-800' },
      draft: { text: 'Rascunho', color: 'bg-gray-100 text-gray-800' },
      scheduled: { text: 'Agendado', color: 'bg-blue-100 text-blue-800' }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || 
                   statusConfig.draft;
    
    return (
      <div className={`flex items-center gap-2 px-2 py-1 rounded-full text-sm ${config.color}`}>
        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: config.color.split(' ')[0].replace('bg-', '').replace('text-', '') }}></div>
        {config.text}
      </div>
    );
  };

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
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Novo Post
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingPost ? 'Editar Post' : 'Novo Post'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="block text-sm font-medium mb-2">Título</label>
                <Input
                  value={editingPost?.title || ''}
                  onChange={(e) => setEditingPost({ ...editingPost, title: e.target.value })}
                  placeholder="Título do post"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Categoria</label>
                <Select
                  value={editingPost?.category || ''}
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
                <label className="block text-sm font-medium mb-2">Status</label>
                <Select
                  value={editingPost?.status || 'draft'}
                  onValueChange={(value) => setEditingPost({ ...editingPost, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Rascunho</SelectItem>
                    <SelectItem value="published">Publicado</SelectItem>
                    <SelectItem value="scheduled">Agendado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Autor</label>
                <Input
                  value={editingPost?.author || ''}
                  onChange={(e) => setEditingPost({ ...editingPost, author: e.target.value })}
                  placeholder="Nome do autor"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Conteúdo</label>
                <Textarea
                  value={editingPost?.content || ''}
                  onChange={(e) => setEditingPost({ ...editingPost, content: e.target.value })}
                  placeholder="Conteúdo do post..."
                  className="min-h-[200px]"
                />
              </div>
              
              <Button onClick={handleSavePost} className="w-full">
                Salvar Post
              </Button>
            </div>
          </DialogContent>
        </Dialog>
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
                      {new Date(post.date).toLocaleDateString('pt-BR', {
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

// Helper components
function Select({ children, value, onValueChange }: { children: React.ReactNode; value: string; onValueChange: (value: string) => void }) {
  return (
    <div className="relative">
      <select
        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
      >
        {children}
      </select>
    </div>
  );
}

function SelectTrigger({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
      {children}
    </div>
  );
}

function SelectContent({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute z-10 mt-1 w-full rounded-md bg-white shadow-lg border">
      {children}
    </div>
  );
}

function SelectItem({ value, children }: { value: string; children: React.ReactNode }) {
  return (
    <div
      className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm"
      onClick={() => {
        // This would be handled by the parent select
      }}
    >
      {children}
    </div>
  );
}

function SelectValue({ placeholder }: { placeholder: string }) {
  return (
    <span className="text-gray-500">{placeholder}</span>
  );
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`border rounded-lg p-4 ${className}`}>
      {children}
    </div>
  );
}

function CardHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      {children}
    </div>
  );
}

function CardContent({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      {children}
    </div>
  );
}

function CardTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h3 className={`font-medium ${className}`}>
      {children}
    </h3>
  );
}