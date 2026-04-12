import { SITE_NAME, PRIVACY_EMAIL, SUPPORT_PHONE, SUPPORT_PHONE_TEL } from '@/lib/site';

const PrivacyPolicy = () => (
  <div className="min-h-screen bg-background">
    <div className="container mx-auto px-6 py-16 max-w-3xl">
      <h1 className="font-display text-4xl text-foreground mb-2">Privacy Policy</h1>
      <p className="font-body text-muted-foreground mb-10">Last updated — April 12, 2026</p>

      <div className="prose prose-neutral dark:prose-invert font-body space-y-8 text-foreground/90">
        <section>
          <h2 className="font-display text-xl text-foreground">1. Who we are</h2>
          <p>
            {SITE_NAME} operates the Platform and acts as the data controller for the personal data collected through it.
            This policy explains what we collect, why we collect it, how we share it, and the rights you have under the Kenya
            Data Protection Act, 2019 and related regulations.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl text-foreground">2. What we collect</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Account details:</strong> name, email address, phone number, password hash, and login metadata.</li>
            <li><strong>Profile details:</strong> location, timezone, avatar, and other information you choose to add.</li>
            <li><strong>Therapy intake data:</strong> questionnaire answers about concerns, preferences, demographics, and other health-related information.</li>
            <li><strong>Booking data:</strong> therapist selections, session times, payment status, notes you choose to provide, and cancellation information.</li>
            <li><strong>Therapist application data:</strong> professional credentials, bio, service offerings, and verification documents or details.</li>
            <li><strong>Support and communications:</strong> messages you send to us by email, form, or in-app support.</li>
            <li><strong>Technical data:</strong> device/browser information, log data, IP address, and basic usage analytics.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-xl text-foreground">3. How we use your data</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>To create and manage your account and keep it secure.</li>
            <li>To match you with therapists, including automated ranking based on your questionnaire responses.</li>
            <li>To book, confirm, and manage sessions and reminders.</li>
            <li>To verify therapists and manage public therapist profiles.</li>
            <li>To process payments, commissions, refunds, and disputes.</li>
            <li>To comply with legal, accounting, tax, and regulatory obligations.</li>
            <li>To improve the Platform, prevent fraud, and maintain safety.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-xl text-foreground">4. Lawful basis and sensitive data</h2>
          <p>
            We rely on lawful bases permitted by law, including contract, consent, legitimate interests, and legal obligation,
            depending on the activity. Because therapy matching can involve sensitive health-related information, we ask for
            clear consent and limit processing to what is necessary to provide the service. If you withdraw consent for a
            feature that depends on consent, we may no longer be able to provide that feature.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl text-foreground">5. Sharing and recipients</h2>
          <p>We do not sell your personal data. We may share it only with:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Therapists and staff who need it to provide or manage services.</li>
            <li>Service providers such as hosting, authentication, storage, analytics, messaging, and payment processors.</li>
            <li>Professional advisers, auditors, regulators, or law enforcement where required or permitted by law.</li>
            <li>Emergency services or third parties where needed to protect life or respond to a serious safety risk.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-xl text-foreground">6. International transfers</h2>
          <p>
            Some of our service providers may process data outside Kenya. Where that happens, we use reasonable contractual,
            technical, and organisational safeguards and only transfer data where the law allows it.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl text-foreground">7. Automated matching and profiling</h2>
          <p>
            We use questionnaire answers to rank and suggest therapists. This is a form of profiling. The result is only a
            recommendation, not a binding medical decision. You remain free to choose a therapist yourself and to ignore the
            recommendation list.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl text-foreground">8. How long we keep data</h2>
          <p>
            We keep personal data only as long as needed for the purposes above, including legal, accounting, tax, dispute,
            and backup requirements. If you delete your account, we aim to remove active personal data within 30 days, subject
            to any legal retention duties and backup cycles.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl text-foreground">9. Security and breaches</h2>
          <p>
            We use technical and organisational safeguards such as access controls, row-level security, encryption in transit,
            and least-privilege access. No system is perfectly secure. If a data breach occurs, we will take the steps required
            by law, which may include notifying the ODPC and affected data subjects.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl text-foreground">10. Your rights</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Access:</strong> ask for the personal data we hold about you.</li>
            <li><strong>Correction:</strong> fix inaccurate or incomplete data.</li>
            <li><strong>Deletion:</strong> request deletion where the law allows it.</li>
            <li><strong>Restriction/objection:</strong> object to or restrict certain processing.</li>
            <li><strong>Portability:</strong> request a copy in a usable format where applicable.</li>
            <li><strong>Withdraw consent:</strong> withdraw consent for consent-based processing at any time.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-xl text-foreground">11. Cookies and analytics</h2>
          <p>
            We use essential cookies for authentication and core features. We may use non-essential analytics only to understand
            usage and improve the Platform. Where consent is required for analytics cookies or similar tools, we will ask for it.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl text-foreground">12. Children</h2>
          <p>
            The Platform is intended for adults aged 18 and above. We do not knowingly collect personal data from children
            under 18.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl text-foreground">13. Complaints and contact</h2>
          <p>
            To exercise your rights or ask privacy questions, contact us at{' '}
            <a href={SUPPORT_PHONE_TEL} className="text-primary hover:underline">
              {SUPPORT_PHONE}
            </a>{' '}
            or{' '}
            <a href={`mailto:${PRIVACY_EMAIL}`} className="text-primary hover:underline">
              {PRIVACY_EMAIL}
            </a>
            . You may also lodge a complaint with the Office of the Data Protection Commissioner if you are not satisfied with
            our response.
          </p>
        </section>
      </div>
    </div>
  </div>
);

export default PrivacyPolicy;
