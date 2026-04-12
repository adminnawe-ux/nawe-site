import { Link } from 'react-router-dom';
import { SITE_NAME, SUPPORT_EMAIL, SUPPORT_PHONE, SUPPORT_PHONE_TEL } from '@/lib/site';

const Terms = () => (
  <div className="min-h-screen bg-background">
    <nav className="border-b border-border bg-card/80 backdrop-blur-md">
      <div className="container mx-auto px-6 flex items-center h-16">
        <Link to="/" className="flex items-center">
          <img src="/logo.png" alt={SITE_NAME} className="h-10" />
        </Link>
      </div>
    </nav>

    <div className="container mx-auto px-6 py-16 max-w-3xl">
      <h1 className="font-display text-4xl text-foreground mb-2">Terms &amp; Conditions</h1>
      <p className="font-body text-muted-foreground mb-10">Version 2.0 — Effective April 12, 2026</p>

      <div className="prose prose-neutral dark:prose-invert font-body space-y-8 text-foreground/90">
        <section>
          <h2 className="font-display text-xl text-foreground">1. Acceptance</h2>
          <p>
            By creating an account, submitting the questionnaire, or using {SITE_NAME} (the "Platform"), you agree to these
            Terms, our Privacy Policy, and any additional notices shown in the app. If you do not agree, do not use the Platform.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl text-foreground">2. What the Platform does</h2>
          <p>
            {SITE_NAME} is a marketplace that helps people discover, compare, book, and manage sessions with independent,
            licensed therapists. We provide the platform, not therapy, diagnosis, or emergency services.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl text-foreground">3. No emergency use</h2>
          <p>
            The Platform is not for emergencies, suicidal crisis, or immediate danger. If you or someone else is in danger,
            call local emergency services or go to the nearest emergency facility immediately. Do not rely on the Platform for
            crisis intervention.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl text-foreground">4. Accounts and eligibility</h2>
          <p>
            You must provide accurate, current information when registering and keep your account credentials secure. You must
            be at least 18 years old to use the Platform unless we explicitly approve a different arrangement in writing.
            You are responsible for all activity on your account.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl text-foreground">5. Therapist verification</h2>
          <p>
            Therapists must have valid credentials and may only provide services within their lawful professional scope.
            Verification does not mean we supervise, guarantee, or take responsibility for the therapist's clinical judgment.
            Therapists are independent contractors, not employees of {SITE_NAME}.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl text-foreground">6. Bookings, cancellations, and payments</h2>
          <p>
            Session fees, cancellation windows, and availability are set by each therapist and shown before booking. Payments
            are handled through the Platform, and our commission is deducted from therapist earnings according to the published
            tier schedule. Refunds and disputes are handled under the booking and payment rules shown in the app and any payment
            provider terms.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl text-foreground">7. Privacy, confidentiality, and content</h2>
          <p>
            We collect only the data needed to operate the Platform. Personal health information you share through the
            questionnaire, booking flow, reviews, messages, or support channels is processed under our Privacy Policy and the
            privacy settings of the applicable feature. Do not post sensitive clinical details in public reviews or public
            comments. Review and profile content may be moderated or removed if it violates these Terms.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl text-foreground">8. Acceptable use</h2>
          <p>
            You may not impersonate anyone, harass others, upload unlawful or harmful content, attempt to access another
            user's account or data, misuse therapist verification, scrape the Platform, or use the Platform to avoid fees or
            solicit off-platform work in a way that breaks our rules or any applicable law.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl text-foreground">9. No medical advice and no warranty</h2>
          <p>
            Content on the Platform is for information and matchmaking only. {SITE_NAME} does not guarantee any outcome from
            therapy or provide medical advice, diagnosis, or treatment. The Platform is provided "as is" and "as available" to
            the fullest extent permitted by law.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl text-foreground">10. Liability</h2>
          <p>
            To the maximum extent permitted by law, {SITE_NAME} is not liable for the acts, omissions, advice, or outcomes of
            therapists, nor for indirect or consequential losses arising from your use of the Platform.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl text-foreground">11. Changes and suspension</h2>
          <p>
            We may update these Terms, suspend access, or remove content if required for safety, compliance, fraud prevention,
            or platform integrity. Material changes will be posted on the Platform and may be communicated by email or in-app.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl text-foreground">12. Governing law</h2>
          <p>
            These Terms are governed by the laws of Kenya. Any dispute that cannot be resolved informally may be brought in a
            competent Kenyan court, unless another dispute process is required by law or a separate written agreement.
          </p>
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
