import { Link } from 'react-router-dom';
import { Phone, ExternalLink, BookOpen, Heart, Brain, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const helplines = [
  { name: 'Befrienders Kenya', phone: '+254 722 178 177', url: 'https://www.befrienderskenya.org', country: 'Kenya' },
  { name: 'Uganda Counselling Association', phone: '+256 414 258 780', url: '#', country: 'Uganda' },
  { name: 'Find a Helpline (Global)', phone: null, url: 'https://findahelpline.com', country: 'Worldwide' },
];

const selfCareTopics = [
  {
    icon: Brain,
    title: 'Understanding anxiety',
    description: 'Anxiety is your body\'s natural response to stress. Learn to recognise the signs and simple techniques to manage it day-to-day.',
  },
  {
    icon: Heart,
    title: 'Building healthy habits',
    description: 'Small, consistent actions — like sleep routines, movement, and social connection — can make a meaningful difference to your wellbeing.',
  },
  {
    icon: MessageCircle,
    title: 'How to talk about mental health',
    description: 'Starting the conversation can be the hardest part. We share simple ways to open up to friends, family, or a professional.',
  },
];

const Resources = () => (
  <div className="min-h-screen bg-background">
    {/* Hero */}
    <section className="py-20 md:py-24">
      <div className="container mx-auto px-6 max-w-3xl text-center">
        <h1 className="font-display text-4xl md:text-5xl text-foreground mb-6">Resources</h1>
        <p className="font-body text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
          Whether you're in crisis, exploring self-care, or just curious about therapy — we've gathered helpful resources to support you.
        </p>
      </div>
    </section>

    {/* Crisis support */}
    <section className="py-16 bg-destructive/5 border-y border-destructive/20">
      <div className="container mx-auto px-6 max-w-3xl">
        <div className="flex items-center gap-3 mb-6">
          <Phone className="h-6 w-6 text-destructive" />
          <h2 className="font-display text-2xl text-foreground">Need immediate help?</h2>
        </div>
        <p className="font-body text-muted-foreground mb-8">
          If you or someone you know is in crisis, please reach out. You are not alone, and help is available right now.
        </p>
        <div className="space-y-4">
          {helplines.map((h) => (
            <div key={h.name} className="flex items-center justify-between bg-card rounded-xl p-4 border border-border">
              <div>
                <p className="font-ui font-semibold text-foreground">{h.name}</p>
                <p className="font-body text-sm text-muted-foreground">{h.country}</p>
              </div>
              <div className="flex items-center gap-3">
                {h.phone && (
                  <a href={`tel:${h.phone}`} className="font-ui text-sm text-primary hover:underline">
                    {h.phone}
                  </a>
                )}
                <a href={h.url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* Self-care topics */}
    <section className="py-20">
      <div className="container mx-auto px-6 max-w-4xl">
        <h2 className="font-display text-2xl text-foreground mb-10 text-center">Self-care starting points</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {selfCareTopics.map((t) => (
            <div key={t.title} className="bg-card rounded-2xl p-6 border border-border">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <t.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-ui font-semibold text-foreground mb-2">{t.title}</h3>
              <p className="font-body text-sm text-muted-foreground leading-relaxed">{t.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* Journal / blog link */}
    <section className="py-16 bg-card border-y border-border">
      <div className="container mx-auto px-6 max-w-3xl text-center">
        <BookOpen className="h-8 w-8 text-primary mx-auto mb-4" />
        <h2 className="font-display text-2xl text-foreground mb-3">Read our Journal</h2>
        <p className="font-body text-muted-foreground mb-6">
          Our team and therapist community share insights on mental health, wellbeing, and navigating life's challenges.
        </p>
        <Link to="/blog">
          <Button className="font-ui bg-primary hover:bg-primary/90">Browse articles</Button>
        </Link>
      </div>
    </section>

    {/* CTA */}
    <section className="py-20">
      <div className="container mx-auto px-6 max-w-3xl text-center">
        <h2 className="font-display text-2xl text-foreground mb-4">Ready to talk to someone?</h2>
        <p className="font-body text-muted-foreground mb-8">
          Finding the right therapist is one of the most important steps you can take. Let us help you get matched.
        </p>
        <Link to="/questionnaire">
          <Button size="lg" className="font-ui bg-accent hover:bg-accent/90 text-accent-foreground">
            Find a therapist
          </Button>
        </Link>
      </div>
    </section>
  </div>
);

export default Resources;
