import { PRIVACY_EMAIL, SUPPORT_PHONE, SUPPORT_PHONE_TEL } from '@/lib/site';
import { SITE_NAME, PRIVACY_EMAIL, SUPPORT_PHONE, SUPPORT_PHONE_TEL } from '@/lib/site';

const PrivacyPolicy = () => (
  <div className="min-h-screen bg-background">
    <div className="container mx-auto px-6 py-16 max-w-3xl">
      <h1 className="font-display text-4xl text-foreground mb-2">Privacy Policy</h1>
      <p className="font-body text-muted-foreground mb-10">Last updated — March 2026</p>

      <div className="prose prose-neutral dark:prose-invert font-body space-y-8 text-foreground/90">
        <section>
          <h2 className="font-display text-xl text-foreground">1. Introduction</h2>
          <p>At {SITE_NAME} ("we", "us", "the Platform"), your privacy matters deeply. This policy explains what data we collect, why we collect it, and how we protect it. We are committed to GDPR-aligned data practices.</p>
        </section>

        <section>
          <h2 className="font-display text-xl text-foreground">2. What we collect</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Account information:</strong> Name, email address, and phone number when you sign up.</li>
            <li><strong>Intake responses:</strong> Answers to our matching questionnaire (concerns, preferences, demographics). These are used solely to find your best therapist match.</li>
            <li><strong>Session data:</strong> Booking times, session format, and status — never session content.</li>
            <li><strong>Usage data:</strong> Anonymous analytics to improve our platform (pages visited, features used).</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-xl text-foreground">3. How we use your data</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>To match you with suitable therapists based on your preferences.</li>
            <li>To facilitate session bookings and reminders.</li>
            <li>To improve our services and user experience.</li>
            <li>To communicate important updates about your account or sessions.</li>
          </ul>
          <p className="mt-3">We <strong>never</strong> sell your personal data to third parties.</p>
        </section>

        <section>
          <h2 className="font-display text-xl text-foreground">4. Therapist access</h2>
          <p>Therapists receive only an <strong>anonymised summary</strong> of your intake responses — your concerns and session preferences — before a booking is confirmed. Your full name and contact details are only shared once you book a session.</p>
        </section>

        <section>
          <h2 className="font-display text-xl text-foreground">5. Data security</h2>
          <p>All data is encrypted at rest and in transit. We use industry-standard security practices including row-level security, secure authentication, and regular security audits. Our infrastructure is hosted on trusted, enterprise-grade cloud providers.</p>
        </section>

        <section>
          <h2 className="font-display text-xl text-foreground">6. Data retention</h2>
          <p>We retain your data for as long as your account is active. If you delete your account, all associated personal data is permanently removed within 30 days. Anonymised, aggregated data may be retained for analytics purposes.</p>
        </section>

        <section>
          <h2 className="font-display text-xl text-foreground">7. Your rights</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Access:</strong> Request a copy of the data we hold about you.</li>
            <li><strong>Correction:</strong> Update or correct inaccurate information.</li>
            <li><strong>Deletion:</strong> Delete your account and all associated data at any time.</li>
            <li><strong>Portability:</strong> Request your data in a machine-readable format.</li>
            <li><strong>Objection:</strong> Opt out of non-essential data processing.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-xl text-foreground">8. Cookies</h2>
          <p>We use essential cookies to keep you logged in and remember your preferences. We do not use advertising or tracking cookies. Analytics cookies are anonymised and do not identify individual users.</p>
        </section>

        <section>
          <h2 className="font-display text-xl text-foreground">9. Third-party services</h2>
          <p>We use trusted third-party services for authentication, payments, and infrastructure. These services are contractually bound to protect your data and only process it on our behalf.</p>
        </section>

        <section>
          <h2 className="font-display text-xl text-foreground">10. Children's privacy</h2>
          <p>{SITE_NAME} is intended for users aged 18 and above. We do not knowingly collect data from children under 18.</p>
        </section>

        <section>
          <h2 className="font-display text-xl text-foreground">11. Changes to this policy</h2>
          <p>We may update this policy from time to time. Material changes will be communicated via email or in-app notification. Continued use of the Platform after changes constitutes acceptance.</p>
        </section>

        <section>
          <h2 className="font-display text-xl text-foreground">12. Contact us</h2>
          <p>
            For privacy-related questions or to exercise your rights, contact us at{' '}
            <a href={SUPPORT_PHONE_TEL} className="text-primary hover:underline">
              {SUPPORT_PHONE}
            </a>{' '}
            or{' '}
            <a href={`mailto:${PRIVACY_EMAIL}`} className="text-primary hover:underline">
              {PRIVACY_EMAIL}
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  </div>
);

export default PrivacyPolicy;
