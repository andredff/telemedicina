import { useParams, useNavigate } from "react-router-dom";
import PublicHeader from "@/components/layout/PublicHeader";
import Footer from "@/components/layout/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, ArrowLeft, Clock, User, Share2 } from "lucide-react";

const BlogPost = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Mock blog posts data
  const posts = [
    {
      id: "1",
      title: "Janeiro Branco: Cuidados com a Saúde Mental",
      excerpt: "Descubra a importância de cuidar da saúde mental e como a telemedicina pode ajudar.",
      category: "Saúde Mental",
      date: "2024-01-15",
      image: "https://images.unsplash.com/photo-1544027993-37dbfe43562a?auto=format&fit=crop&w=800&q=80",
      author: "Dra. Ana Silva",
      readTime: "8 min",
      content: `
        <p className="mb-4">Janeiro Branco é uma campanha dedicada à conscientização sobre a saúde mental. Em um mundo cada vez mais acelerado, cuidar da nossa saúde emocional tornou-se tão importante quanto cuidar da saúde física.</p>

        <h2 className="text-2xl font-heading font-semibold mb-4 mt-8">A Importância da Saúde Mental</h2>

        <p className="mb-4">A saúde mental afeta todos os aspectos da nossa vida: relacionamentos, trabalho, produtividade e bem-estar geral. Problemas como ansiedade, depressão e estresse podem ter impactos significativos em nossa qualidade de vida.</p>

        <h2 className="text-2xl font-heading font-semibold mb-4 mt-8">Sinais de que Você Precisa de Ajuda</h2>

        <ul className="list-disc pl-6 mb-4 space-y-2">
          <li>Sentimentos persistentes de tristeza ou desesperança</li>
          <li>Dificuldade em concentrar-se ou tomar decisões</li>
          <li>Mudanças significativas no sono ou apetite</li>
          <li>Perda de interesse em atividades que antes traziam prazer</li>
          <li>Sentimentos de culpa ou inutilidade excessivos</li>
        </ul>

        <h2 className="text-2xl font-heading font-semibold mb-4 mt-8">Como a Telemedicina Pode Ajudar</h2>

        <p className="mb-4">A telemedicina revolucionou o acesso aos cuidados de saúde mental. Com a Novità, você pode:</p>

        <ol className="list-decimal pl-6 mb-4 space-y-2">
          <li><strong>Consultar especialistas</strong> de qualquer lugar, sem precisar se deslocar</li>
          <li>Ter acesso a <strong>psicólogos e psiquiatras</strong> qualificados</li>
          <li>Receber <strong>tratamento contínuo</strong> com acompanhamento regular</li>
          <li>Manter sua <strong>privacidade</strong> com consultas online seguras</li>
          <li>Obter <strong>receitas digitais</strong> quando necessário</li>
        </ol>

        <h2 className="text-2xl font-heading font-semibold mb-4 mt-8">Dicas para Cuidar da Saúde Mental</h2>

        <p className="mb-4">Além de buscar ajuda profissional quando necessário, você pode adotar hábitos que promovem o bem-estar mental:</p>

        <div className="space-y-4">
          <div className="bg-muted p-4 rounded-lg">
            <h3 className="font-semibold mb-2">Pratique a atenção plena (mindfulness)</h3>
            <p>Dedique alguns minutos por dia para meditação ou exercícios de respiração.</p>
          </div>

          <div className="bg-muted p-4 rounded-lg">
            <h3 className="font-semibold mb-2">Mantenha uma rotina saudável</h3>
            <p>Dormir bem, alimentar-se adequadamente e praticar exercícios físicos regularmente.</p>
          </div>

          <div className="bg-muted p-4 rounded-lg">
            <h3 className="font-semibold mb-2">Conecte-se com outras pessoas</h3>
            <p>Mantenha relacionamentos saudáveis e busque apoio quando necessário.</p>
          </div>

          <div className="bg-muted p-4 rounded-lg">
            <h3 className="font-semibold mb-2">Limite o tempo nas redes sociais</h3>
            <p>O excesso de informações pode aumentar a ansiedade e o estresse.</p>
          </div>
        </div>

        <h2 className="text-2xl font-heading font-semibold mb-4 mt-8">Quando Procurar Ajuda</h2>

        <p className="mb-4">Não hesite em buscar ajuda profissional se você ou alguém que você conhece estiver enfrentando dificuldades emocionais. A saúde mental é tão importante quanto a saúde física, e cuidar dela é um ato de autocuidado.</p>

        <p className="mb-4">Na Novità, oferecemos consultas com psicólogos e psiquiatras através da nossa plataforma de telemedicina. Você pode agendar uma consulta a qualquer momento e receber o suporte de que precisa.</p>

        <div className="bg-primary/10 p-4 rounded-lg mt-8">
          <p className="font-semibold mb-2">💡 Dica da Novità:</p>
          <p>Nosso plano Bronze já inclui consultas ilimitadas com clínico geral 24h, e você pode adicionar consultas com especialistas em saúde mental nos planos superiores.</p>
        </div>
      `
    },
    {
      id: "2",
      title: "5 Dicas para Manter a Imunidade em Alta",
      excerpt: "Conheça hábitos simples que podem fortalecer seu sistema imunológico.",
      category: "Bem-estar",
      date: "2024-01-10",
      image: "https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=800&q=80",
      author: "Dr. Carlos Mendes",
      readTime: "6 min",
      content: `
        <p className="mb-4">Manter o sistema imunológico forte é essencial para prevenir doenças e manter a saúde em dia. Com alguns hábitos simples, você pode fortalecer suas defesas naturais.</p>

        <h2 className="text-2xl font-heading font-semibold mb-4 mt-8">1. Alimentação Balanceada</h2>

        <p className="mb-4">Uma dieta rica em nutrientes é fundamental para a imunidade. Inclua em sua alimentação:</p>

        <ul className="list-disc pl-6 mb-4 space-y-2">
          <li><strong>Vitamina C:</strong> Frutas cítricas, morango, kiwi</li>
          <li><strong>Vitamina D:</strong> Peixes gordurosos, ovos, exposição solar moderada</li>
          <li><strong>Zinco:</strong> Castanhas, sementes, leguminosas</li>
          <li><strong>Probióticos:</strong> Iogurte natural, kefir, kombucha</li>
          <li><strong>Antioxidantes:</strong> Frutas vermelhas, vegetais coloridos</li>
        </ul>

        <h2 className="text-2xl font-heading font-semibold mb-4 mt-8">2. Hidratação Adequada</h2>

        <p className="mb-4">Beber água suficiente ajuda a eliminar toxinas e mantém as mucosas hidratadas, que são a primeira barreira contra vírus e bactérias.</p>

        <h2 className="text-2xl font-heading font-semibold mb-4 mt-8">3. Sono de Qualidade</h2>

        <p className="mb-4">Durante o sono, nosso corpo produz citocinas, proteínas que combatem infecções e inflamações. Dormir 7-9 horas por noite é ideal para a saúde imunológica.</p>

        <h2 className="text-2xl font-heading font-semibold mb-4 mt-8">4. Atividade Física Regular</h2>

        <p className="mb-4">Exercícios moderados ajudam a aumentar a circulação de células imunológicas e reduzem o estresse, que pode enfraquecer o sistema imune.</p>

        <h2 className="text-2xl font-heading font-semibold mb-4 mt-8">5. Gerenciamento do Estresse</h2>

        <p className="mb-4">O estresse crônico libera cortisol, um hormônio que pode suprimir a função imunológica. Práticas como meditação, ioga e respiração profunda podem ajudar.</p>

        <div className="bg-primary/10 p-4 rounded-lg mt-8">
          <p className="font-semibold mb-2">💡 Dica da Novità:</p>
          <p>Nosso plano Ouro inclui check-up anual, onde você pode avaliar seus níveis de vitaminas e minerais essenciais para a imunidade.</p>
        </div>
      `
    },
    {
      id: "3",
      title: "Telemedicina: O Futuro da Saúde",
      excerpt: "Entenda como as consultas online estão transformando o atendimento médico.",
      category: "Telemedicina",
      date: "2024-01-05",
      image: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=800&q=80",
      author: "Dr. Roberto Almeida",
      readTime: "10 min",
      content: `
        <p className="mb-4">A telemedicina está revolucionando a forma como acessamos os cuidados de saúde. Com a tecnologia, é possível receber atendimento médico de qualidade sem sair de casa.</p>

        <h2 className="text-2xl font-heading font-semibold mb-4 mt-8">O Que é Telemedicina?</h2>

        <p className="mb-4">Telemedicina é a prestação de serviços de saúde à distância, utilizando tecnologias de informação e comunicação. Isso inclui consultas online, monitoramento remoto, diagnóstico à distância e muito mais.</p>

        <h2 className="text-2xl font-heading font-semibold mb-4 mt-8">Vantagens da Telemedicina</h2>

        <div className="space-y-4">
          <div className="bg-muted p-4 rounded-lg">
            <h3 className="font-semibold mb-2">🏠 Conveniência</h3>
            <p>Consulte médicos sem precisar se deslocar, economizando tempo e dinheiro.</p>
          </div>

          <div className="bg-muted p-4 rounded-lg">
            <h3 className="font-semibold mb-2">⏰ Acesso 24/7</h3>
            <p>Atendimento disponível a qualquer hora, ideal para emergências e dúvidas.</p>
          </div>

          <div className="bg-muted p-4 rounded-lg">
            <h3 className="font-semibold mb-2">🌍 Acesso a Especialistas</h3>
            <p>Consulte médicos especialistas independentemente da sua localização geográfica.</p>
          </div>

          <div className="bg-muted p-4 rounded-lg">
            <h3 className="font-semibold mb-2">🔒 Privacidade</h3>
            <p>Consultas realizadas em ambiente seguro e confidencial.</p>
          </div>
        </div>

        <h2 className="text-2xl font-heading font-semibold mb-4 mt-8">Como Funciona na Novità</h2>

        <p className="mb-4">Na Novità, oferecemos telemedicina completa com:</p>

        <ol className="list-decimal pl-6 mb-4 space-y-2">
          <li><strong>Consultas online</strong> com clínicos gerais e especialistas</li>
          <li><strong>Receitas digitais</strong> válidas em todo o Brasil</li>
          <li><strong>Entrega de medicamentos</strong> na sua casa</li>
          <li><strong>Acompanhamento contínuo</strong> do seu histórico médico</li>
        </ol>

        <h2 className="text-2xl font-heading font-semibold mb-4 mt-8">O Futuro da Saúde</h2>

        <p className="mb-4">A telemedicina veio para ficar e continuará evoluindo com tecnologias como inteligência artificial, monitoramento remoto avançado e integração com wearables.</p>

        <p className="mb-4">Na Novità, estamos na vanguarda dessa revolução, oferecendo cuidados de saúde acessíveis e de qualidade para todos.</p>

        <div className="bg-primary/10 p-4 rounded-lg mt-8">
          <p className="font-semibold mb-2">💡 Dica da Novità:</p>
          <p>Todos os nossos planos incluem consultas ilimitadas com clínico geral 24h. Experimente a telemedicina hoje mesmo!</p>
        </div>
      `
    }
  ];

  const post = posts.find(p => p.id === id);

  if (!post) {
    return (
      <div className="min-h-screen bg-background">
        <PublicHeader />
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-3xl font-heading font-bold mb-4">Artigo não encontrado</h1>
          <p className="text-muted-foreground mb-6">O artigo que você está procurando não existe.</p>
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
              <h1 className="text-3xl md:text-4xl font-heading font-bold text-foreground mb-4">
                {post.title}
              </h1>
              <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>{new Date(post.date).toLocaleDateString("pt-BR")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>{post.readTime} de leitura</span>
                </div>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <span>Por {post.author}</span>
                </div>
              </div>
            </div>

            {/* Featured Image */}
            <div className="mb-8">
              <img 
                src={post.image} 
                alt={post.title} 
                className="w-full h-64 md:h-96 object-cover rounded-lg"
              />
            </div>

            {/* Article Content */}
            <Card className="bg-card border-border/50">
              <CardContent className="p-6 md:p-8 prose max-w-none">
                <div dangerouslySetInnerHTML={{ __html: post.content }} />
              </CardContent>
            </Card>

            {/* Share Section */}
            <div className="mt-8 flex justify-center">
              <Button variant="outline" className="gap-2">
                <Share2 className="h-4 w-4" />
                Compartilhar este artigo
              </Button>
            </div>

            {/* Related Articles */}
            <div className="mt-16">
              <h2 className="text-2xl font-heading font-semibold mb-8">Artigos Relacionados</h2>
              <div className="grid md:grid-cols-2 gap-6">
                {posts.filter(p => p.id !== id).slice(0, 2).map((relatedPost) => (
                  <Card 
                    key={relatedPost.id} 
                    className="bg-card border-border/50 hover:shadow-card transition-all cursor-pointer group overflow-hidden"
                    onClick={() => navigate(`/blog/${relatedPost.id}`)}
                  >
                    <div className="h-40 overflow-hidden">
                      <img src={relatedPost.image} alt={relatedPost.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    </div>
                    <CardContent className="p-4">
                      <Badge variant="secondary" className="mb-2">{relatedPost.category}</Badge>
                      <h3 className="font-heading font-semibold text-foreground group-hover:text-primary transition-colors mb-2">
                        {relatedPost.title}
                      </h3>
                      <p className="text-muted-foreground text-sm mb-3">{relatedPost.excerpt}</p>
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3 w-3" />
                          {new Date(relatedPost.date).toLocaleDateString("pt-BR")}
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
          </article>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default BlogPost;
