import { useNavigate } from "react-router-dom";
import PublicHeader from "@/components/layout/PublicHeader";
import Footer from "@/components/layout/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, ArrowRight } from "lucide-react";

const Blog = () => {
  const navigate = useNavigate();
  const posts = [
    {
      id: 1,
      title: "Janeiro Branco: Cuidados com a Saúde Mental",
      excerpt: "Descubra a importância de cuidar da saúde mental e como a telemedicina pode ajudar.",
      category: "Saúde Mental",
      date: "2024-01-15",
      image: "https://images.unsplash.com/photo-1544027993-37dbfe43562a?auto=format&fit=crop&w=800&q=80"
    },
    {
      id: 2,
      title: "5 Dicas para Manter a Imunidade em Alta",
      excerpt: "Conheça hábitos simples que podem fortalecer seu sistema imunológico.",
      category: "Bem-estar",
      date: "2024-01-10",
      image: "https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=800&q=80"
    },
    {
      id: 3,
      title: "Telemedicina: O Futuro da Saúde",
      excerpt: "Entenda como as consultas online estão transformando o atendimento médico.",
      category: "Telemedicina",
      date: "2024-01-05",
      image: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=800&q=80"
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />

      <section className="py-16 lg:py-24">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h1 className="text-4xl md:text-5xl font-heading font-bold text-foreground mb-4">
              Blog <span className="gradient-text">Você Sabia?</span>
            </h1>
            <p className="text-lg text-muted-foreground">
              Dicas de saúde, bem-estar e novidades sobre telemedicina.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {posts.map((post) => (
              <Card 
              key={post.id} 
              className="bg-card border-border/50 hover:shadow-card transition-all cursor-pointer group overflow-hidden"
              onClick={() => navigate(`/blog/${post.id}`)}
            >
                <div className="h-48 overflow-hidden">
                  <img src={post.image} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                </div>
                <CardContent className="p-6 space-y-4">
                  <Badge variant="secondary">{post.category}</Badge>
                  <h3 className="text-xl font-heading font-semibold text-foreground group-hover:text-primary transition-colors">
                    {post.title}
                  </h3>
                  <p className="text-muted-foreground text-sm">{post.excerpt}</p>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      {new Date(post.date).toLocaleDateString("pt-BR")}
                    </div>
                    <span className="flex items-center gap-1 text-primary">
                      Ler mais <ArrowRight className="h-4 w-4" />
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Blog;