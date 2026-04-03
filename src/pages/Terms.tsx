import { Link } from 'react-router-dom';
import { SUPPORT_EMAIL, SUPPORT_PHONE, SUPPORT_PHONE_TEL } from '@/lib/site';

const Terms = () => (
  <div className="min-h-screen bg-background">
    <nav className="border-b border-border bg-card/80 backdrop-blur-md">
      <div className="container mx-auto px-6 flex items-center h-16">
        <Link to="/" className="flex items-center">
          <img src="/logo.png" alt="Nawe Wellness" className="h-10" />
        </Link>
      </div>
    </nav>

    <div className="container mx-auto px-6 py-16 max-w-3xl">
      <h1 className="font-display text-4xl text-foreground mb-2">Terms &amp; Conditions</h1>
      <p className="font-body text-muted-foreground mb-10">Version 1.0 — Effective March 2026</p>

      <div className="prose prose-neutral dark:prose-invert font-body space-y-8 text-foreground/90">
        <section>
          <h2 className="font-display text-xl text-foreground">1. Acceptance of Terms</h2>
          <p>By creating an account or using Nawe Wellness ("the Platform"), you agree to be bound by these Terms &amp; Conditions. If you do not agree, please do not use the Platform.</p>
        </section>

        <section>
          <h2 className="font-display text-xl text-foreground">2. Platform Overview</h2>
          <p>Nawe Wellness is a therapy marketplace that connects clients with licensed therapists. We facilitate discovery, booking, and session management but do not provide therapy services directly.</p>
        </section>

        <section>
          <h2 className="font-display text-xl text-foreground">3. User Accounts</h2>
          <p>You must provide accurate, current information when registering. You are responsible for maintaining the confidentiality of your account credentials. You must be at least 18 years old to use this Platform.</p>
        </section>

        <section>
          <h2 className="font-display text-xl text-foreground">4. Client Terms</h2>
          <p>Clients use the Platform to find and book sessions with therapists. Session fees are set by individual therapists and displayed before booking. Cancellation policies are set by each therapist and shown on their profile.</p>
        </section>

        <section>
          <h2 className="font-display text-xl text-foreground">5. Therapist Terms</h2>
          <p>Therapists must hold valid, verifiable professional credentials. The Platform charges a tiered commission on session fees. Therapists are independent contractors, not employees of Nawe Wellness. Therapists are solely responsible for the quality and legality of their services.</p>
        </section>

        <section>
          <h2 className="font-display text-xl text-foreground">6. Payments &amp; Commissions</h2>
          <p>Session payments are processed through the Platform. A tiered commission rate is deducted from therapist earnings based on monthly revenue thresholds. Payout schedules and methods are outlined in the therapist portal.</p>
        </section>

        <section>
          <h2 className="font-display text-xl text-foreground">7. Privacy &amp; Confidentiality</h2>
          <p>We take your privacy seriously. Personal health information shared during sessions is between you and your therapist. The Platform collects only the data necessary to facilitate services. See our Privacy Policy for full details.</p>
        </section>

        <section>
          <h2 className="font-display text-xl text-foreground">8. Prohibited Conduct</h2>
          <p>Users may not: impersonate others, harass or abuse other users, use the Platform for illegal purposes, attempt to access accounts or data belonging to others, or circumvent Platform fees.</p>
        </section>

        <section>
          <h2 className="font-display text-xl text-foreground">9. Disclaimer of Warranties</h2>
          <p>The Platform is provided "as is" without warranties of any kind. Nawe Wellness does not guarantee the outcome of any therapy session. We are not liable for the actions or advice of therapists on the Platform.</p>
        </section>

        <section>
          <h2 className="font-display text-xl text-foreground">10. Limitation of Liability</h2>
          <p>To the maximum extent permitted by law, Nawe Wellness shall not be liable for any indirect, incidental, or consequential damages arising from your use of the Platform.</p>
        </section>

        <section>
          <h2 className="font-display text-xl text-foreground">11. Termination</h2>
          <p>We reserve the right to suspend or terminate accounts that violate these Terms. Users may delete their accounts at any time through the settings page.</p>
        </section>

        <section>
          <h2 className="font-display text-xl text-foreground">12. Changes to Terms</h2>
          <p>We may update these Terms from time to time. Users will be notified of material changes. Continued use of the Platform after changes constitutes acceptance of the updated Terms.</p>
        </section>

        <section>
          <h2 className="font-display text-xl text-foreground">13. Contact</h2>
          <p>
            For questions about these Terms, contact us at{' '}
            <a href={SUPPORT_PHONE_TEL} className="text-primary hover:underline">
              {SUPPORT_PHONE}
            </a>{' '}
            or{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-primary hover:underline">
              {SUPPORT_EMAIL}
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  </div>
);

export default Terms;
