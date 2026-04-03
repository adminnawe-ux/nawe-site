import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Heart, Users, Star, ArrowRight, Shield, MessageCircle, Calendar } from 'lucide-react';

const stats = [
  { label: 'Licensed Therapists', value: '20+' },
  { label: 'Sessions Completed', value: '1000+' },
  { label: 'Average Match Rating', value: '4.8/5' },
];

const steps = [
  {
    icon: MessageCircle,
    title: 'Match',
    description: 'Tell us what you need. We\'ll match you with the right therapist.',
  },
  {
    icon: Users,
    title: 'Meet',
    description: 'Review your top matches, read their profiles, and choose someone who feels right for you.',
  },
  {
    icon: Calendar,
    title: 'Book',
    description: 'Schedule your first session at a time that works. Your therapist is looking forward to meeting you.',
  },
];

const testimonials = [
  {
    text: '"Nawe helped me find a therapist who truly understands my culture and my struggles. I finally feel heard."',
    name: 'Sarah M.',
    location: 'Nairobi',
  },
  {
    text: '"The matching process was so gentle and thoughtful. Within a week, I had my first session and it changed everything."',
    name: 'James K.',
    location: 'Qatar',
  },
  {
    text: '"I was nervous about starting therapy. Nawe made it feel safe and welcoming from the very first step."',
    name: 'Amina R.',
    location: 'Kampala',
  },
];

const Index = () => {
  return (
    <div>
      {/* Hero */}
      <section className="relative min-h-screen flex items-center overflow-hidden">
        {/* Organic blob bg */}
        <div className="absolute inset-0 -z-10">
          <svg className="absolute top-0 right-0 w-[600px] h-[600px] opacity-20" viewBox="0 0 600 600">
            <circle cx="300" cy="300" r="280" fill="hsl(var(--primary))" />
          </svg>
          <svg className="absolute bottom-0 left-0 w-[400px] h-[400px] opacity-10" viewBox="0 0 400 400">
            <circle cx="200" cy="200" r="180" fill="hsl(var(--secondary))" />
          </svg>
        </div>

        <div className="container mx-auto px-6">
          <div className="max-w-3xl mx-auto text-center animate-fade-in">
            <h1 className="font-display text-4xl md:text-6xl text-foreground leading-tight mb-6">
              Tuko nawe.{' '}
              <span className="text-muted-foreground">Let's find the right support for you.</span>
            </h1>
            <p className="font-body text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
              Connect with licensed therapists who understand you.
              Wherever you are.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/questionnaire">
                <Button size="lg" className="font-ui text-base px-8 py-6 rounded-full bg-primary hover:bg-primary/90 shadow-soft">
                  Find a Therapist
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link to="/how-it-works">
                <Button variant="outline" size="lg" className="font-ui text-base px-8 py-6 rounded-full border-border">
                  How It Works
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Trust indicators */}
      <section className="min-h-screen flex items-center border-y border-border bg-card">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-center gap-12">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="font-display text-3xl text-foreground">{stat.value}</p>
                <p className="font-ui text-sm text-muted-foreground mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="min-h-screen flex items-center py-20">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="font-display text-3xl md:text-4xl text-foreground mb-4">
              Three simple steps to support
            </h2>
            <p className="font-body text-muted-foreground max-w-xl mx-auto">
              We've made it easy to find the right therapist. No long forms, no confusion — just a warm, guided experience.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {steps.map((step, i) => (
              <div
                key={step.title}
                className="bg-card rounded-card p-8 shadow-card text-center border border-border hover:shadow-soft transition-shadow"
                style={{ animationDelay: `${i * 0.15}s` }}
              >
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 mb-5">
                  <step.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-display text-xl text-foreground mb-3">{step.title}</h3>
                <p className="font-body text-sm text-muted-foreground leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="min-h-screen flex items-center bg-card border-y border-border py-20">
        <div className="container mx-auto px-6">
          <h2 className="font-display text-3xl md:text-4xl text-foreground text-center mb-14">
            Stories from our community
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {testimonials.map((t) => (
              <div key={t.name} className="bg-background rounded-card p-8 shadow-card border border-border">
                <div className="flex gap-1 mb-4">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star key={s} className="h-4 w-4 fill-warning text-warning" />
                  ))}
                </div>
                <p className="font-body text-foreground italic leading-relaxed mb-6">{t.text}</p>
                <div>
                  <p className="font-ui text-sm font-medium text-foreground">{t.name}</p>
                  <p className="font-ui text-xs text-muted-foreground">{t.location}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="min-h-screen flex items-center py-20">
        <div className="container mx-auto px-6">
          <div className="max-w-2xl mx-auto text-center">
            <Heart className="h-10 w-10 text-accent mx-auto mb-6" />
            <h2 className="font-display text-3xl md:text-4xl text-foreground mb-4">
              Your journey starts with one step
            </h2>
            <p className="font-body text-muted-foreground mb-8 max-w-lg mx-auto">
              You don't have to figure this out alone. Let us help you find a therapist who understands.
            </p>
            <Link to="/questionnaire">
              <Button size="lg" className="font-ui text-base px-8 py-6 rounded-full bg-accent hover:bg-accent/90 text-accent-foreground shadow-soft">
                Start Your Match
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Index;
