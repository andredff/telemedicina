import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import PublicHeader from "@/components/layout/PublicHeader";
import Footer from "@/components/layout/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, ArrowRight, Loader2 } from "lucide-react";
import { BLOG_ARTICLES, BLOG_PLACEHOLDER } from "@/data/landingContent";

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  category: string;
  created_at: string;
  published_at: string | null;
  featured_image: string | null;
  views: number;
}

const Blog = () => {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const { data, error } = await supabase
          .from('blog_posts')
          .select('id, title, slug, excerpt, category, created_at, published_at, featured_image, views')
          .eq('status', 'published')
          .order('published_at', { ascending: false });

        if (error) throw error;
        setPosts(data || []);
      } catch (err) {
        console.error('Erro ao carregar posts:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPosts();
  }, []);

  // Imagens padrão por categoria
  const getCategoryImage = (category: string) => {
    const images: Record<string, string> = {
      'Saúde Mental': 'https://images.unsplash.com/photo-1544027993-37dbfe43562a?auto=format&fit=crop&w=800&q=80',
      'Nutrição': 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=800&q=80',
      'Telemedicina': 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=800&q=80',
      'Bem-estar': 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=800&q=80',
    };
    return images[category] || 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=800&q=80';
  };

  const fallbackPosts: BlogPost[] = BLOG_ARTICLES.map((article, index) => ({
    id: `fallback-${index + 1}`,
    title: article.title,
    slug: "",
    excerpt: article.excerpt,
    category: article.category,
    created_at: new Date().toISOString(),
    published_at: null,
    featured_image: null,
    views: 0,
  }));

  const visiblePosts = posts.length > 0 ? posts : fallbackPosts;

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />

      <section className="py-16 lg:py-24">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h1 className="text-4xl md:text-5xl font-heading font-bold text-primary mb-4">
              Blog <span className="text-primary">Você Sabia?</span>
            </h1>
            <p className="text-lg text-muted-foreground">
              Dicas de saúde, bem-estar e novidades sobre telemedicina.
            </p>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
            {posts.length === 0 && (
              <p className="mb-8 text-center text-sm text-muted-foreground">
                {BLOG_PLACEHOLDER.message}
              </p>
            )}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {visiblePosts.map((post) => (
                <Card 
                  key={post.id} 
                  className={`bg-card border-border/50 hover:shadow-card transition-all group overflow-hidden ${
                    post.slug ? "cursor-pointer" : ""
                  }`}
                  onClick={() => {
                    if (post.slug) navigate(`/blog/${post.slug}`);
                  }}
                >
                  <div className="h-48 overflow-hidden">
                    <img 
                      src={post.featured_image || getCategoryImage(post.category)} 
                      alt={post.title} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                    />
                  </div>
                  <CardContent className="p-6 space-y-4">
                    <Badge variant="secondary">{post.category}</Badge>
                    <h3 className="text-xl font-heading font-semibold text-foreground group-hover:text-primary transition-colors">
                      {post.title}
                    </h3>
                    <p className="text-muted-foreground text-sm line-clamp-2">
                      {post.excerpt || 'Leia mais sobre este artigo...'}
                    </p>
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        {new Date(post.published_at || post.created_at).toLocaleDateString("pt-BR")}
                      </div>
                      <span className="flex items-center gap-1 text-primary">
                        {post.slug ? "Ler mais" : "Em breve"} <ArrowRight className="h-4 w-4" />
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            </>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Blog;
