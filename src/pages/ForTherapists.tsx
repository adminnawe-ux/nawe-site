import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, Users, Shield, DollarSign, Star } from 'lucide-react';

const ForTherapists = () => (
  <div>
    {/* Hero */}
    <section className="py-24 md:py-36">
      <div className="container mx-auto px-6 max-w-3xl text-center">
        <h1 className="font-display text-4xl md:text-5xl text-foreground mb-6">
          Grow your practice.{' '}
          <span className="text-primary">Change lives.</span>
        </h1>
        <p className="font-body text-lg text-muted-foreground mb-10 max-w-xl mx-auto leading-relaxed">
          Join a network of licensed professionals helping clients across East Africa and beyond.
          We handle the matching, scheduling, and payments — you focus on what matters.
        </p>
        <Link to="/therapist-portal/onboarding">
          <Button size="lg" className="font-ui text-base px-8 py-6 rounded-full bg-primary shadow-soft">
            Apply to Join
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </Link>
      </div>
    </section>

    {/* Benefits */}
    <section className="py-20 bg-card border-y border-border">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-5xl mx-auto">
          {[
            { icon: Users, title: 'Client Matching', desc: 'We connect you with clients who are the right fit for your expertise.' },
            { icon: Shield, title: 'Verified Platform', desc: 'Your credentials are verified and displayed professionally.' },
            { icon: DollarSign, title: 'Secure Payments', desc: 'Get paid reliably via bank transfer, M-Pesa, or Wise.' },
            { icon: Star, title: 'Build Reputation', desc: 'Collect verified reviews and grow your practice.' },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="text-center p-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-display text-lg text-foreground mb-2">{title}</h3>
              <p className="font-body text-sm text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* Commission */}
    <section className="py-20">
      <div className="container mx-auto px-6 max-w-2xl text-center">
        <h2 className="font-display text-3xl text-foreground mb-4">Transparent pricing</h2>
        <p className="font-body text-muted-foreground mb-8">
          You keep 80% of every session fee. No hidden costs, no surprises. Payouts on your schedule.
        </p>
        <Link to="/therapist-portal/onboarding">
          <Button className="font-ui rounded-full px-8">Start Your Application</Button>
        </Link>
      </div>
    </section>
  </div>
);

export default ForTherapists;
