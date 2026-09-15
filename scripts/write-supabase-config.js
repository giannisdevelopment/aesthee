#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const out = path.join(__dirname, "..", "js", "supabase-config.js");

if (!url || !anonKey) {
  if (fs.existsSync(out)) {
    console.log("supabase-config.js already present; env not set — keeping file.");
    process.exit(0);
  }
  console.warn(
    "SUPABASE_URL / SUPABASE_ANON_KEY not set. Copy js/supabase-config.example.js → js/supabase-config.js for local use."
  );
  const stub = `window.AESTHEE_SUPABASE = {
  url: "https://YOUR_PROJECT_REF.supabase.co",
  anonKey: "YOUR_SUPABASE_ANON_KEY",
};
`;
  fs.writeFileSync(out, stub);
  process.exit(0);
}

const contents = `window.AESTHEE_SUPABASE = {
  url: ${JSON.stringify(url)},
  anonKey: ${JSON.stringify(anonKey)},
};
`;
fs.writeFileSync(out, contents);
console.log("Wrote js/supabase-config.js from environment.");
