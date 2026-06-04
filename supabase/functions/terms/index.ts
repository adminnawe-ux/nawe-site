const corsHeaders = {
  'Access-Control-Allow-Origin': (Deno.env.get('APP_URL') ?? 'https://nawe.co.ke'),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const terms = {
  version: "1.0",
  effective_date: "2026-03-01",
  sections: [
    { title: "Acceptance of Terms", content: "By creating an account or using Nawe ('the Platform'), you agree to be bound by these Terms & Conditions." },
    { title: "Platform Overview", content: "Nawe is a therapy marketplace that connects clients with licensed therapists. We facilitate discovery, booking, and session management but do not provide therapy services directly." },
    { title: "User Accounts", content: "You must provide accurate, current information when registering. You are responsible for maintaining the confidentiality of your account credentials. You must be at least 18 years old." },
    { title: "Client Terms", content: "Clients use the Platform to find and book sessions with therapists. Session fees are set by individual therapists. Cancellation policies are set by each therapist." },
    { title: "Therapist Terms", content: "Therapists must hold valid, verifiable professional credentials. The Platform charges a tiered commission on session fees. Therapists are independent contractors." },
    { title: "Payments & Commissions", content: "Session payments are processed through the Platform. A tiered commission rate is deducted from therapist earnings based on monthly revenue thresholds." },
    { title: "Privacy & Confidentiality", content: "Personal health information shared during sessions is between you and your therapist. The Platform collects only the data necessary to facilitate services." },
    { title: "Prohibited Conduct", content: "Users may not impersonate others, harass or abuse other users, use the Platform for illegal purposes, or circumvent Platform fees." },
    { title: "Disclaimer of Warranties", content: "The Platform is provided 'as is' without warranties of any kind. Nawe does not guarantee the outcome of any therapy session." },
    { title: "Limitation of Liability", content: "To the maximum extent permitted by law, Nawe shall not be liable for any indirect, incidental, or consequential damages." },
    { title: "Termination", content: "We reserve the right to suspend or terminate accounts that violate these Terms. Users may delete their accounts at any time." },
    { title: "Changes to Terms", content: "We may update these Terms from time to time. Continued use after changes constitutes acceptance." },
    { title: "Contact", content: "For questions about these Terms, contact us at +254716231112 or support@nawe.co.ke." },
  ],
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  return new Response(JSON.stringify(terms), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
