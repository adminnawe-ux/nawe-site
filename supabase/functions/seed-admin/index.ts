import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const email = "admin@nawewellness.org";
  const password = "#admin@nawewellness";

  // Check if user already exists
  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  const existing = existingUsers?.users?.find((u) => u.email === email);

  if (existing) {
    // Ensure admin role exists
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", existing.id)
      .eq("role", "admin");

    if (!roles || roles.length === 0) {
      await supabase.from("user_roles").insert({ user_id: existing.id, role: "admin" });
    }

    return new Response(JSON.stringify({ message: "Admin already exists, role ensured" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // Create admin user
  const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createError) {
    return new Response(JSON.stringify({ error: createError.message }), { status: 400 });
  }

  // Assign admin role (the trigger already creates 'client' role, so add 'admin')
  await supabase.from("user_roles").insert({ user_id: newUser.user.id, role: "admin" });

  return new Response(JSON.stringify({ message: "Admin user created", userId: newUser.user.id }), {
    headers: { "Content-Type": "application/json" },
  });
});
