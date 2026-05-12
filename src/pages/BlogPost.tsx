import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import PublicHeader from "@/components/layout/PublicHeader";
import Footer from "@/components/layout/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, ArrowLeft, ArrowRight, Clock, User, Share2, Loader2 } from "lucide-react";
import DOMPurify from "dompurify";

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  category: string;
  created_at: string;
  published_at: string | null;
  featured_image: string | null;
  author_id: string | null;
  views: number;
}

const BlogPostPage = () => {
  const { id: slug } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [relatedPosts, setRelatedPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    const fetchPost = async () => {
      if (!slug) return;

      try {
        // Buscar post pelo slug
        const { data, error } = await supabase
          .from('blog_posts')
          .select('*')
          .eq('slug', slug)
          .eq('status', 'published')
          .single();

        if (error) throw error;
        setPost(data);

        // Incrementar visualizações
        if (data) {
          await supabase
            .from('blog_posts')
            .update({ views: (data.views || 0) + 1 })
            .eq('id', data.id);

          // Buscar posts relacionados (mesma categoria, exceto atual)
          const { data: related } = await supabase
            .from('blog_posts')
            .select('id, title, slug, excerpt, category, created_at, published_at, featured_image, views')
            .eq('status', 'published')
            .eq('category', data.category)
            .neq('id', data.id)
            .order('published_at', { ascending: false })
            .limit(2);

          setRelatedPosts(related || []);
        }
      } catch (err) {
        console.error('Erro ao carregar post:', err);
        setPost(null);
      } finally {
        setLoading(false);
      }
    };

    fetchPost();
  }, [slug]);

  // Estimar tempo de leitura (~200 palavras/min)
  const getReadTime = (content: string) => {
    const words = content.replace(/<[^>]*>/g, '').split(/\s+/).length;
    const minutes = Math.ceil(words / 200);
    return `${minutes} min`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <PublicHeader />
        <div className="container mx-auto px-4 py-16 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
        <Footer />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-background">
        <PublicHeader />
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-3xl font-heading font-bold mb-4">Artigo não encontrado</h1>
          <p className="text-muted-foreground mb-6">O artigo que você está procurando não existe ou foi removido.</p>
          <Button onClick={() => navigate("/blog")} variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para o Blog
          </Button>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />

      <section className="py-16 lg:py-24">
        <div className="container mx-auto px-4 max-w-4xl">
          {/* Back Button */}
          <Button 
            onClick={() => navigate("/blog")} 
            variant="ghost" 
            className="mb-8 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para o Blog
          </Button>

          {/* Article Header */}
          <article>
            <div className="text-center mb-8">
              <Badge variant="secondary" className="mb-4">{post.category}</Badge>
              <h1 className="text-3xl md:text-4xl font-heading font-bold text-primary mb-4">
                {post.title}
              </h1>
              <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground flex-wrap">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>{new Date(post.published_at || post.created_at).toLocaleDateString("pt-BR")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>{getReadTime(post.content)} de leitura</span>
                </div>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <span>Por Equipe Novità</span>
                </div>
              </div>
            </div>

            {/* Featured Image */}
            <div className="mb-8">
              <img 
                src={post.featured_image || getCategoryImage(post.category)} 
                alt={post.title} 
                className="w-full h-64 md:h-96 object-cover rounded-lg"
              />
            </div>

            {/* Article Content */}
            <Card className="bg-card border-border/50">
              <CardContent className="p-8 md:p-16 prose prose-lg max-w-none dark:prose-invert prose-p:leading-9 prose-p:mb-8 prose-h2:mt-14 prose-h2:mb-6 prose-h3:mt-10 prose-h3:mb-4 prose-li:mb-3 prose-ul:my-8 prose-ol:my-8 prose-hr:my-12">
                <div
                  className="[&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-primary [&_h2]:mt-14 [&_h2]:mb-5 [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:text-primary [&_h3]:mt-10 [&_h3]:mb-4 [&_p]:leading-9 [&_p]:mb-7 [&_p]:text-base [&_ul]:my-7 [&_ul]:pl-6 [&_ol]:my-7 [&_ol]:pl-6 [&_li]:mb-3 [&_li]:leading-8 [&_hr]:my-12 [&_hr]:border-border [&_a]:text-blue-600 [&_a]:underline [&_a:hover]:text-blue-800 [&_strong]:font-semibold"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(post.content, { ADD_TAGS: ['iframe'], ADD_ATTR: ['target', 'rel'] }) }}
                />
              </CardContent>
            </Card>

            {/* Share Section */}
            <div className="mt-8 flex justify-center">
              <Button 
                variant="outline" 
                className="gap-2"
                onClick={() => {
                  if (navigator.share) {
                    navigator.share({
                      title: post.title,
                      text: post.excerpt || '',
                      url: window.location.href,
                    });
                  } else {
                    navigator.clipboard.writeText(window.location.href);
                  }
                }}
              >
                <Share2 className="h-4 w-4" />
                Compartilhar este artigo
              </Button>
            </div>

            {/* Related Articles */}
            {relatedPosts.length > 0 && (
              <div className="mt-16">
                <h2 className="text-2xl font-heading font-semibold mb-8">Artigos Relacionados</h2>
                <div className="grid md:grid-cols-2 gap-6">
                  {relatedPosts.map((relatedPost) => (
                    <Card 
                      key={relatedPost.id} 
                      className="bg-card border-border/50 hover:shadow-card transition-all cursor-pointer group overflow-hidden"
                      onClick={() => navigate(`/blog/${relatedPost.slug}`)}
                    >
                      <div className="h-40 overflow-hidden">
                        <img 
                          src={relatedPost.featured_image || getCategoryImage(relatedPost.category)} 
                          alt={relatedPost.title} 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                        />
                      </div>
                      <CardContent className="p-4">
                        <Badge variant="secondary" className="mb-2">{relatedPost.category}</Badge>
                        <h3 className="font-heading font-semibold text-foreground group-hover:text-primary transition-colors mb-2">
                          {relatedPost.title}
                        </h3>
                        <p className="text-muted-foreground text-sm mb-3 line-clamp-2">
                          {relatedPost.excerpt || 'Leia mais sobre este artigo...'}
                        </p>
                        <div className="flex items-center justify-between text-sm text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-3 w-3" />
                            {new Date(relatedPost.published_at || relatedPost.created_at).toLocaleDateString("pt-BR")}
                          </div>
                          <span className="flex items-center gap-1 text-primary">
                            Ler mais <ArrowRight className="h-3 w-3" />
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </article>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default BlogPostPage;
