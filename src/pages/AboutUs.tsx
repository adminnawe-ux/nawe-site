import { Heart, Users, Globe, Shield } from 'lucide-react';
import { SUPPORT_EMAIL, SUPPORT_PHONE, SUPPORT_PHONE_TEL } from '@/lib/site';

const values = [
  {
    icon: Heart,
    title: 'Warmth first',
    description: 'We believe healing starts with feeling safe. Every part of Nawe is designed to feel like a trusted friend, not a cold directory.',
  },
  {
    icon: Users,
    title: 'Accessible to all',
    description: 'Quality mental health support shouldn\'t be a luxury. We work with therapists who offer sliding-scale fees and flexible session formats.',
  },
  {
    icon: Globe,
    title: 'Rooted in community',
    description: 'Built for East Africa, by people who understand the cultural nuances of seeking help. We celebrate the diversity of our communities.',
  },
  {
    icon: Shield,
    title: 'Privacy & dignity',
    description: 'Your story is yours. We encrypt everything, anonymise your data, and give you full control over what you share and with whom.',
  },
];

const team = [
  { name: 'The Nawe Team', role: 'We\'re a small, passionate team of designers, engineers, and mental health advocates based in East Africa. We built Nawe because we saw a gap — and we wanted to fill it with care.' },
];

const AboutUs = () => (
  <div className="min-h-screen bg-background">
    {/* Hero */}
    <section className="py-20 md:py-28">
      <div className="container mx-auto px-6 max-w-3xl text-center">
        <h1 className="font-display text-4xl md:text-5xl text-foreground mb-6">
          Everyone deserves someone to talk to
        </h1>
        <p className="font-body text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
          Nawe Wellness is a mental health marketplace built for East Africa. We connect people with licensed, vetted therapists — making it simple, affordable, and dignifying to get the support you need.
        </p>
      </div>
    </section>

    {/* Mission */}
    <section className="py-16 bg-card border-y border-border">
      <div className="container mx-auto px-6 max-w-3xl">
        <h2 className="font-display text-2xl text-foreground mb-4">Our mission</h2>
        <p className="font-body text-muted-foreground leading-relaxed">
          Mental health care in East Africa is growing — but it's still hard to find the right therapist, understand costs, or even know where to start. Nawe exists to remove those barriers. We handle discovery, matching, and booking so you can focus on what matters: your wellbeing.
        </p>
      </div>
    </section>

    {/* Values */}
    <section className="py-20">
      <div className="container mx-auto px-6 max-w-4xl">
        <h2 className="font-display text-2xl text-foreground mb-10 text-center">What we stand for</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {values.map((v) => (
            <div key={v.title} className="flex gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <v.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-ui font-semibold text-foreground mb-1">{v.title}</h3>
                <p className="font-body text-sm text-muted-foreground leading-relaxed">{v.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* Team */}
    <section className="py-16 bg-card border-y border-border">
      <div className="container mx-auto px-6 max-w-3xl">
        <h2 className="font-display text-2xl text-foreground mb-4">Who we are</h2>
        {team.map((t) => (
          <div key={t.name}>
            <p className="font-body text-muted-foreground leading-relaxed">{t.role}</p>
          </div>
        ))}
      </div>
    </section>

    {/* Contact */}
    <section className="py-20">
      <div className="container mx-auto px-6 max-w-3xl text-center">
        <h2 className="font-display text-2xl text-foreground mb-4">Get in touch</h2>
        <p className="font-body text-muted-foreground">
          Questions, partnerships, or callback requests? Reach us at{' '}
          <a href={SUPPORT_PHONE_TEL} className="text-primary hover:underline">
            {SUPPORT_PHONE}
          </a>{' '}
          or{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-primary hover:underline">
            {SUPPORT_EMAIL}
          </a>
        </p>
      </div>
    </section>
  </div>
);

export default AboutUs;
