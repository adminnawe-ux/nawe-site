import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ClipboardList, Users, CalendarCheck, Heart, Shield, Lock, MessageCircle } from 'lucide-react';
import { SITE_NAME } from '@/lib/site';

const steps = [
  {
    icon: ClipboardList,
    number: '01',
    title: 'Take the questionnaire',
    description: 'Answer a few simple questions about what you\'re going through, your preferences, and what matters most to you in a therapist. It takes about 3 minutes.',
  },
  {
    icon: Users,
    number: '02',
    title: 'Get matched',
    description: 'Our matching system pairs you with licensed therapists who fit your needs — based on specialisation, language, cultural background, and budget.',
  },
  {
    icon: CalendarCheck,
    number: '03',
    title: 'Book your session',
    description: 'Browse your matches, read their profiles, and book a session at a time that works for you. Choose between video, phone, or in-person.',
  },
  {
    icon: Heart,
    number: '04',
    title: 'Start your journey',
    description: 'Meet your therapist and begin healing. You can always switch therapists or adjust your preferences — no pressure, no judgement.',
  },
];

const expectations = [
  {
    icon: MessageCircle,
    title: 'Your first session',
    description: 'Your therapist will spend the first session getting to know you — your background, what brought you here, and your goals. There\'s no pressure to share everything at once.',
  },
  {
    icon: Lock,
    title: 'Complete confidentiality',
    description: 'Everything you share is strictly confidential. Your therapist is bound by professional ethics and local laws to protect your privacy.',
  },
  {
    icon: Shield,
    title: 'Transparent pricing',
    description: 'You\'ll always see the session fee upfront before booking. Many therapists offer sliding-scale pricing if cost is a concern.',
  },
];

const faqs = [
  {
    question: 'How much does a session cost?',
    answer: 'Session fees vary by therapist. Most sessions range from KES 2,000 to KES 8,000. Many therapists offer sliding-scale rates based on your financial situation. You\'ll always see the price before booking.',
  },
  {
    question: 'Do I need a referral to start therapy?',
    answer: 'No. You can sign up and book a session directly. No referral, no diagnosis, no gatekeeping — just support when you need it.',
  },
  {
    question: 'Can I switch therapists?',
    answer: 'Absolutely. Finding the right fit is important. You can retake the questionnaire, browse other matches, and book with someone new at any time.',
  },
  {
    question: 'What if I\'m in crisis right now?',
    answer: 'If you\'re in immediate danger, please call your local emergency number. You can also visit findahelpline.com for crisis support lines in your country. Nawe is not a crisis service.',
  },
  {
    question: 'How are therapists verified?',
    answer: 'Every therapist on our platform goes through a verification process. We check professional credentials, licensing, and qualifications before they can accept clients.',
  },
  {
    question: 'What payment methods are accepted?',
    answer: 'We support M-Pesa, bank transfer, and card payments. Payment is processed securely before your session.',
  },
  {
    question: 'Can I cancel or reschedule a session?',
    answer: 'Yes. Each therapist sets their own cancellation policy, which is visible on their profile. Most allow free cancellation up to 24 hours before the session.',
  },
];

const HowItWorks = () => (
  <div>
    {/* Hero */}
    <section className="py-24 md:py-32">
      <div className="container mx-auto px-6 max-w-3xl text-center">
        <h1 className="font-display text-4xl md:text-5xl text-foreground mb-6">
          Getting help should be{' '}
          <span className="text-primary">simple</span>
        </h1>
        <p className="font-body text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
          From your first question to your first session — here's how {SITE_NAME}
          connects you with the right therapist, step by step.
        </p>
      </div>
    </section>

    {/* Steps */}
    <section className="py-20 bg-card border-y border-border">
      <div className="container mx-auto px-6 max-w-4xl">
        <div className="grid gap-12 md:gap-16">
          {steps.map(({ icon: Icon, number, title, description }, i) => (
            <div key={number} className="flex gap-6 md:gap-8 items-start">
              <div className="flex-shrink-0 flex flex-col items-center">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                {i < steps.length - 1 && (
                  <div className="w-px h-12 md:h-16 bg-border mt-3" />
                )}
              </div>
              <div className="pt-2">
                <span className="font-ui text-xs text-primary font-semibold uppercase tracking-wider">Step {number}</span>
                <h3 className="font-display text-2xl text-foreground mt-1 mb-2">{title}</h3>
                <p className="font-body text-muted-foreground leading-relaxed max-w-lg">{description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* What to expect */}
    <section className="py-20">
      <div className="container mx-auto px-6 max-w-4xl">
        <h2 className="font-display text-3xl text-foreground text-center mb-12">What to expect</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {expectations.map(({ icon: Icon, title, description }) => (
            <div key={title} className="bg-card rounded-card p-8 border border-border shadow-card text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-display text-lg text-foreground mb-2">{title}</h3>
              <p className="font-body text-sm text-muted-foreground leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* FAQ */}
    <section className="py-20 bg-card border-y border-border">
      <div className="container mx-auto px-6 max-w-2xl">
        <h2 className="font-display text-3xl text-foreground text-center mb-10">Common questions</h2>
        <Accordion type="single" collapsible className="space-y-3">
          {faqs.map(({ question, answer }, i) => (
            <AccordionItem key={i} value={`faq-${i}`} className="bg-background rounded-xl border border-border px-6">
              <AccordionTrigger className="font-ui text-sm text-foreground hover:no-underline py-4">
                {question}
              </AccordionTrigger>
              <AccordionContent className="font-body text-sm text-muted-foreground pb-4 leading-relaxed">
                {answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>

    {/* CTA */}
    <section className="py-24">
      <div className="container mx-auto px-6 max-w-2xl text-center">
        <h2 className="font-display text-3xl text-foreground mb-4">Ready to take the first step?</h2>
        <p className="font-body text-muted-foreground mb-8">
          It starts with a simple questionnaire. No commitment, no pressure — just clarity.
        </p>
        <Link to="/questionnaire">
          <Button size="lg" className="font-ui text-base px-8 py-6 rounded-full bg-primary shadow-soft">
            Start the Questionnaire
          </Button>
        </Link>
      </div>
    </section>
  </div>
);

export default HowItWorks;
