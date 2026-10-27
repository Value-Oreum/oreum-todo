import { defineCloudflareConfig } from "@opennextjs/cloudflare";
// This app uses Supabase for data, with no ISR or R2 cache requirement.
export default defineCloudflareConfig();
