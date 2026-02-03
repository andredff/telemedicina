import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;
const patientEmail = process.env.E2E_PATIENT_EMAIL;
const patientPassword = process.env.E2E_PATIENT_PASSWORD;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_* key.");
  process.exit(1);
}

if (!adminEmail || !adminPassword || !patientEmail || !patientPassword) {
  console.error("Missing E2E_* credentials.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

async function testLogin(label, email, password, expectRole) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data?.user) {
    return { ok: false, error: error?.message || "Login failed" };
  }

  const userId = data.user.id;
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, email, role")
    .eq("id", userId)
    .single();

  if (profileError) {
    return { ok: false, error: `Profile fetch failed: ${profileError.message}` };
  }

  if (expectRole && profile?.role !== expectRole) {
    return { ok: false, error: `Unexpected role: ${profile?.role}` };
  }

  // Sanity query - should not error under RLS
  const { error: ordersError } = await supabase
    .from("orders")
    .select("id")
    .limit(1);

  if (ordersError) {
    return { ok: false, error: `Orders query failed: ${ordersError.message}` };
  }

  await supabase.auth.signOut();
  return { ok: true };
}

const results = [];

results.push(await testLogin("admin", adminEmail, adminPassword, "admin"));
results.push(await testLogin("patient", patientEmail, patientPassword, "patient"));

const failed = results.filter((r) => !r.ok);
if (failed.length) {
  console.error("Smoke auth failed:", failed.map((f) => f.error).join(" | "));
  process.exit(1);
}

console.log("Smoke auth OK");
