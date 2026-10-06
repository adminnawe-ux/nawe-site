import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

// Audience page: community partners. Built from existing content (Grow's
// partnership types, Events). The enquiry reuses the existing corporate-enquiry
// function, tagged as a community programme enquiry.

const partners = [
  'NGOs and civil society',
  'Schools and youth organisations',
  'Government and public institutions',
  'Development and research partners',
  'Faith and community groups',
];

const programmes = [
  { title: 'Community workshops', body: 'Facilitated sessions held where people already gather: schools, places of worship and community halls.' },
  { title: 'Peer support', body: 'Groups that help people share experiences, build connection and learn coping skills together.' },
  { title: 'Resilience programmes', body: 'Practical, longer programmes that build resilience for families, youth and field teams.' },
];

const Communities = () => {
  const [form, setForm] = useState({ organisation: '', contactName: '', email: '', message: '' });
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');

  const valid = form.organisation.trim() && form.contactName.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email);

  const submit = async () => {
    setStatus('loading');
    const { error } = await supabase.functions.invoke('corporate-enquiry', {
      body: {
        company_name: form.organisation.trim(),
        contact_name: form.contactName.trim(),
        email: form.email.trim(),
        phone: null,
        employees: null,
        plan: 'Community programme enquiry',
        message: form.message.trim() || null,
      },
    });
    setStatus(error ? 'error' : 'done');
  };

  const field = 'w-full rounded-lg px-4 py-3 font-ui text-sm border border-border bg-background text-foreground placeholder:text-muted-foreground outline-none focus:border-brand-navy/60';

  return (
    <div>
      {/* Intro */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <p className="font-ui text-sm uppercase tracking-widest text-muted-foreground mb-6">For communities and partners</p>
            <h1 className="font-display text-5xl md:text-6xl text-brand-navy leading-tight mb-6">
              Wellbeing grows where people connect.
            </h1>
            <p className="font-body text-xl text-foreground leading-relaxed mb-10">
              We work with NGOs, schools, government, development partners and community organisations to co-design and deliver practical wellbeing programmes. We are an implementation partner, not only a place to refer people for therapy.
            </p>
            <a href="#enquire">
              <Button size="lg" className="font-ui text-lg px-8 py-6 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground">
                Start a programme enquiry <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </a>
          </div>
          <img
            src="/site-revamp/peer_group.webp"
            alt="Members of a community peer support circle sitting together in a hall"
            className="w-full rounded-card object-cover aspect-[4/3]"
            loading="eager"
          />
        </div>
      </section>

      {/* Programmes */}
      <section className="py-24 bg-brand-sky">
        <div className="container mx-auto px-6">
          <p className="font-ui text-sm uppercase tracking-widest text-brand-navy/60 mb-4">What we deliver</p>
          <h2 className="font-display text-4xl md:text-5xl text-brand-navy mb-14 max-w-2xl">Programmes built with the people they serve</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {programmes.map((p) => (
              <div key={p.title} className="bg-white rounded-card p-8 flex flex-col gap-4">
                <h3 className="font-display text-2xl text-brand-navy">{p.title}</h3>
                <p className="font-body text-base text-brand-navy/70 leading-relaxed">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Who we work with, and events */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-16">
          <div>
            <p className="font-ui text-sm uppercase tracking-widest text-muted-foreground mb-4">Who we work with</p>
            <ul className="font-body text-xl text-foreground space-y-3">
              {partners.map((p) => <li key={p} className="border-b border-border pb-3">{p}</li>)}
            </ul>
          </div>
          <div className="flex flex-col justify-center gap-6">
            <h2 className="font-display text-4xl text-brand-navy">See our work in the community</h2>
            <p className="font-body text-lg text-muted-foreground">Public events, workshops and open conversations are listed on our events page.</p>
            <Link to="/events" className="font-ui font-medium text-primary hover:underline">Browse events →</Link>
          </div>
        </div>
      </section>

      {/* Enquiry */}
      <section id="enquire" className="py-24 bg-brand-sand">
        <div className="container mx-auto px-6 max-w-2xl">
          <h2 className="font-display text-4xl md:text-5xl text-brand-navy mb-4">Start a programme enquiry</h2>
          <p className="font-body text-lg text-brand-navy/70 mb-10">Tell us about your community or organisation and we will get back to you.</p>

          {status === 'done' ? (
            <p className="font-ui text-lg text-brand-navy">Thank you. We have received your enquiry and will be in touch.</p>
          ) : (
            <form
              className="grid gap-4"
              onSubmit={(e) => { e.preventDefault(); if (valid && status !== 'loading') submit(); }}
            >
              <label className="font-ui text-sm text-brand-navy" htmlFor="org">Organisation</label>
              <input id="org" className={field} value={form.organisation} onChange={(e) => setForm({ ...form, organisation: e.target.value })} />
              <label className="font-ui text-sm text-brand-navy" htmlFor="contact">Your name</label>
              <input id="contact" className={field} value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} />
              <label className="font-ui text-sm text-brand-navy" htmlFor="email">Email</label>
              <input id="email" type="email" className={field} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <label className="font-ui text-sm text-brand-navy" htmlFor="message">What would you like to achieve? (optional)</label>
              <textarea id="message" rows={4} className={field} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
              {status === 'error' && (
                <p className="font-ui text-sm text-destructive">Something went wrong. Please try again or contact us directly.</p>
              )}
              <div>
                <Button type="submit" disabled={!valid || status === 'loading'} className="font-ui rounded-full px-8 py-5 bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-60">
                  {status === 'loading' ? 'Sending…' : 'Send enquiry'}
                </Button>
              </div>
            </form>
          )}
        </div>
      </section>
    </div>
  );
};

export default Communities;
