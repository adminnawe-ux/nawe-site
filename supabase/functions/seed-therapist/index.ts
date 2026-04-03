import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const email = "therapist@nawewellness.org";
  const password = "Therapist@123";

  // Check if user already exists
  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  const existing = existingUsers?.users?.find((u) => u.email === email);

  let userId: string;

  if (existing) {
    userId = existing.id;
  } else {
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createError) {
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    userId = newUser.user.id;
  }

  // Ensure therapist role exists
  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "therapist");

  if (!roles || roles.length === 0) {
    await supabase.from("user_roles").insert({ user_id: userId, role: "therapist" });
  }

  // Update profile
  await supabase
    .from("profiles")
    .update({
      first_name: "Amina",
      last_name: "Ochieng",
      phone: "+254712345678",
      country: "Kenya",
      location: "Nairobi",
      timezone: "Africa/Nairobi",
    })
    .eq("user_id", userId);

  // Upsert therapist profile
  const { data: existingTherapist } = await supabase
    .from("therapists")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  const therapistData = {
    user_id: userId,
    professional_title: "Licensed Clinical Psychologist",
    license_number: "KCP-2024-0847",
    issuing_body: "Kenya Counselling & Psychological Association",
    bio: "I'm a licensed clinical psychologist with over 8 years of experience helping individuals navigate anxiety, depression, trauma, and relationship challenges. I believe in creating a warm, non-judgmental space where healing can happen at your own pace. My approach integrates cognitive-behavioural therapy with culturally sensitive practices rooted in the African experience.",
    tagline: "Healing begins when you feel truly heard.",
    specialisations: ["Anxiety", "Depression", "Trauma & PTSD", "Relationship Issues", "Grief & Loss", "Self-Esteem"],
    modalities: ["Cognitive Behavioural Therapy (CBT)", "Person-Centred Therapy", "Trauma-Focused CBT", "Mindfulness-Based Therapy"],
    languages: ["English", "Swahili"],
    session_formats: ["Video Call", "In-Person"],
    client_populations: ["Adults", "Young Adults", "Couples"],
    cultural_competencies: ["East African", "Pan-African", "LGBTQ+ Affirming"],
    education: "MSc Clinical Psychology, University of Nairobi | BSc Psychology, Kenyatta University",
    years_experience: 8,
    price_per_session: 3500,
    currency: "KES",
    sliding_scale: true,
    sliding_scale_min: 2000,
    verified: true,
    verification_status: "approved",
    buffer_minutes: 15,
    max_sessions_per_day: 6,
    insurance_accepted: ["Jubilee Health", "AAR", "NHIF"],
    cancellation_policy: "Free cancellation up to 24 hours before the session. Late cancellations may be charged at 50% of the session fee.",
  };

  if (existingTherapist) {
    await supabase.from("therapists").update(therapistData).eq("id", existingTherapist.id);
  } else {
    await supabase.from("therapists").insert(therapistData);
  }

  return new Response(
    JSON.stringify({
      message: "Therapist seeded successfully",
      credentials: { email, password: "Therapist@123" },
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
