import { createClient } from "@supabase/supabase-js";

// These are the public-safe project URL and publishable key — meant to be
// visible in client-side code. Row Level Security is what actually protects
// the data, not keeping these secret.
const SUPABASE_URL = "https://kjtgvxcuimjlwwiiholm.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_mIq__c7pr2ra2UqACInrtQ_qJeKNco_";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
