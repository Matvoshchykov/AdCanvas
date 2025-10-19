/*
Whop diagnostic runner
Run with: node whop-diagnose.js
It prints a numbered checklist and a final JSON report.
*/

import process from "process";
import fs from "fs";

// Load environment variables from .env.local
try {
  const envFile = fs.readFileSync('.env.local', 'utf8');
  envFile.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      process.env[key.trim()] = valueParts.join('=').trim();
    }
  });
} catch (e) {
  console.log("Warning: Could not load .env.local file");
}

// Load env
const {
  WHOP_SECRET_KEY,
  WHOP_PUBLIC_KEY,
  WHOP_COMPANY_ID,
  WHOP_APP_ID,
  WHOP_ENV,
  DEPLOY_URL,
  WHOP_API_KEY, // This project uses WHOP_API_KEY instead of WHOP_SECRET_KEY
  NEXT_PUBLIC_WHOP_APP_ID,
  NEXT_PUBLIC_WHOP_COMPANY_ID,
} = process.env;

// Use WHOP_API_KEY if WHOP_SECRET_KEY is not present (for this project)
const secretKey = WHOP_SECRET_KEY || WHOP_API_KEY;
const appId = WHOP_APP_ID || NEXT_PUBLIC_WHOP_APP_ID;
const companyId = WHOP_COMPANY_ID || NEXT_PUBLIC_WHOP_COMPANY_ID;

function logCheck(name, ok, details = "", raw = "") {
  console.log("\n=== " + name + " ===");
  console.log("Result:", ok ? "PASS" : "FAIL");
  if (details) console.log("Details:", details);
  if (raw) {
    console.log("Raw response:");
    console.log(raw);
  }
  return { name, ok, details, raw };
}

async function curlFetch(url, method = "GET", headers = {}, body = null) {
  try {
    const res = await fetch(url, { method, headers, body });
    const text = await res.text();
    let parsed;
    try { parsed = JSON.parse(text); } catch(e) { parsed = text; }
    return { status: res.status, ok: res.ok, body: parsed, headers: Object.fromEntries(res.headers) };
  } catch (err) {
    return { error: String(err) };
  }
}

async function main() {
  const results = [];

  console.log("Whop diagnostic runner — starting checks");
  console.log("Environment variables found:");
  console.log("- WHOP_API_KEY:", secretKey ? "present" : "MISSING");
  console.log("- WHOP_APP_ID:", appId || "MISSING");
  console.log("- WHOP_COMPANY_ID:", companyId || "MISSING");
  console.log("- WHOP_ENV:", WHOP_ENV || "not set");
  console.log("- DEPLOY_URL:", DEPLOY_URL || "not set");

  // 1) Basic env presence
  const envOk = secretKey && appId && companyId;
  results.push(logCheck("ENV VARS PRESENT", envOk, 
    `WHOP_API_KEY ${secretKey ? "present" : "MISSING"}, WHOP_APP_ID ${appId ? "present" : "MISSING"}, WHOP_COMPANY_ID ${companyId ? "present" : "MISSING"}`));

  // 2) Verify secret key works for auth — try different endpoints
  if (secretKey) {
    const headers = { "Authorization": `Bearer ${secretKey}`, "Content-Type": "application/json" };
    
    // Try multiple possible endpoints
    const endpoints = [
      "https://api.whop.com/api/v2/companies",
      "https://api.whop.com/api/v2/apps",
      "https://api.whop.com/api/v2/me"
    ];
    
    let authOk = false;
    let authResponse = null;
    
    for (const endpoint of endpoints) {
      const res = await curlFetch(endpoint, "GET", headers);
      if (res && !res.error && (res.status >= 200 && res.status < 300)) {
        authOk = true;
        authResponse = res;
        break;
      }
      if (res && res.status === 403) {
        authResponse = res; // Still capture 403 for analysis
        break;
      }
    }
    
    results.push(logCheck("SECRET KEY AUTHENTICATION", authOk, 
      authResponse ? `Status ${authResponse.status}` : "No response", 
      authResponse ? JSON.stringify(authResponse.body) : ""));
      
    if (!authOk && authResponse && authResponse.body && authResponse.body.error) {
      results.push({ name: "AUTH ERROR RAW", ok: false, details: "Auth returned error", raw: JSON.stringify(authResponse.body) });
    }
  } else {
    results.push(logCheck("SECRET KEY AUTHENTICATION", false, "Missing WHOP_API_KEY"));
  }

  // 3) Confirm the key is a secret key (server-capable) not a public key
  if (secretKey) {
    const isLikelySecret = !secretKey.startsWith("pk_") && secretKey.length > 10;
    results.push(logCheck("SECRET vs PUBLIC KEY HEURISTIC", isLikelySecret, 
      isLikelySecret ? "key appears secret (not starting with pk_)" : "key looks like a public key (starts with pk_). Use secret key on server."));
  }

  // 4) Get App & Company details — to confirm App belongs to Company
  if (secretKey && appId) {
    const headers = { "Authorization": `Bearer ${secretKey}`, "Content-Type": "application/json" };
    const appUrl = `https://api.whop.com/api/v2/apps/${appId}`;
    const appRes = await curlFetch(appUrl, "GET", headers);
    const ok = appRes && !appRes.error && (appRes.status >= 200 && appRes.status < 300);
    results.push(logCheck("APP FETCH", ok, `Status ${appRes.status}`, JSON.stringify(appRes.body)));
    if (ok) {
      // Try to detect company id in returned body
      let linkedCompany = "unknown";
      try {
        const b = appRes.body;
        linkedCompany = b.company_id || b.company || (b.data && b.data.company_id) || "not-found-in-response";
      } catch (e) {}
      results.push(logCheck("APP -> COMPANY MAPPING", linkedCompany === companyId, 
        `App linked company: ${linkedCompany}, provided WHOP_COMPANY_ID: ${companyId}`, JSON.stringify(appRes.body)));
    }
  } else {
    results.push(logCheck("APP FETCH", false, "Missing WHOP_API_KEY or WHOP_APP_ID"));
  }

  // 5) Try SDK approach first, then direct API calls
  if (secretKey && appId) {
    try {
      // Try to import and use the SDK
      const { whopSdk } = await import('./lib/whop-sdk.js');
      
      console.log('Testing SDK approach...');
      const sdkResult = await whopSdk.payments.chargeUser({
        amount: 100,
        currency: "usd",
        userId: "test_user_diag",
        metadata: { diagnostic: true, type: 'no_cooldown_upgrade' }
      });
      
      results.push(logCheck("SDK CHARGE CREATION", true, "SDK method worked", JSON.stringify(sdkResult)));
    } catch (sdkError) {
      results.push(logCheck("SDK CHARGE CREATION", false, `SDK error: ${sdkError.message}`, ""));
      
      // Fallback to direct API calls
      const headers = { "Authorization": `Bearer ${secretKey}`, "Content-Type": "application/json" };
      
      // Try different endpoint variations
      const endpoints = [
        "https://api.whop.com/api/v2/payments/charges",
        "https://api.whop.com/api/v2/charges", 
        "https://api.whop.com/v2/payments/charges",
        "https://api.whop.com/api/v2/checkouts"
      ];
      
      for (const endpoint of endpoints) {
        const payload = {
          amount: 100,
          currency: "usd",
          user_id: "test_user",
          metadata: { diagnostic: true },
          company_id: companyId
        };
        
        const res = await curlFetch(endpoint, "POST", headers, JSON.stringify(payload));
        if (res && (res.status === 200 || res.status === 201)) {
          results.push(logCheck("CHARGE CREATION ATTEMPT", true, `SUCCESS with ${endpoint}`, JSON.stringify(res.body)));
          break;
        } else if (res && res.status !== 404) {
          results.push(logCheck("CHARGE CREATION ATTEMPT", false, `Status ${res.status} on ${endpoint}`, JSON.stringify(res.body)));
          break;
        }
      }
    }
  } else {
    results.push(logCheck("CHARGE CREATION ATTEMPT", false, "Missing WHOP_API_KEY or WHOP_APP_ID"));
  }

  // 6) Check DEPLOY URL reachability (if DEPLOY_URL present)
  if (DEPLOY_URL) {
    const corsRes = await curlFetch(DEPLOY_URL, "GET");
    const corsOk = corsRes && !corsRes.error && (corsRes.status >= 200 && corsRes.status < 400);
    results.push(logCheck("DEPLOY URL REACHABLE", corsOk, `Status ${corsRes.status}`, JSON.stringify(corsRes.body || corsRes)));
  } else {
    results.push(logCheck("DEPLOY URL REACHABLE", false, "No DEPLOY_URL provided"));
  }

  // 7) Check package.json for Whop SDK versions
  try {
    const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    const whopDeps = Object.keys(deps || {}).filter(k => /whop/i.test(k) || /@whop/i.test(k));
    results.push(logCheck("PACKAGE.JSON WHOP SDKS", whopDeps.length > 0, 
      `Found whop-related deps: ${whopDeps.map(dep => `${dep}@${deps[dep]}`).join(", ")}`));
  } catch (e) {
    results.push(logCheck("PACKAGE.JSON CHECK", false, "Could not read package.json"));
  }

  // 8) Rate-limit / Quota detection hint
  results.push(logCheck("RATE LIMIT / QUOTA", true, "If you see 429 in any raw responses above, you are hitting rate limits. Consider exponential backoff or contact Whop support."));

  // 9) Final summary
  console.log("\n=== FINAL SUMMARY ===");
  results.forEach((r, i) => {
    console.log(`${i+1}. ${r.name} - ${r.ok ? "PASS" : "FAIL"} - ${r.details || ""}`);
  });

  // Find first failing check
  const firstFail = results.find(r => !r.ok);
  console.log("\n=== DIAGNOSTIC RESULTS ===");
  if (firstFail) {
    console.log(`FIRST FAILING CHECK: ${firstFail.name}`);
    console.log(`DETAILS: ${firstFail.details}`);
    console.log("RAW RESPONSE:", firstFail.raw);
    console.log("\nIMMEDIATE NEXT STEP:");
    if (firstFail.name === "ENV VARS PRESENT") {
      console.log("→ Set missing environment variables in your .env.local file");
    } else if (firstFail.name === "SECRET KEY AUTHENTICATION") {
      console.log("→ Verify your WHOP_API_KEY is correct and has proper permissions");
    } else if (firstFail.name === "APP FETCH") {
      console.log("→ Check your WHOP_APP_ID is correct and the app exists");
    } else if (firstFail.name === "APP -> COMPANY MAPPING") {
      console.log("→ Verify your app is linked to the correct company ID");
    } else if (firstFail.name.includes("CHARGE") || firstFail.name.includes("CHECKOUT")) {
      console.log("→ Check product permissions and API endpoint availability");
    }
  } else {
    console.log("ALL CHECKS PASSED - No obvious issues found");
  }

  console.log("\nRaw results JSON:");
  console.log(JSON.stringify(results, null, 2));
  
  process.exit(firstFail ? 1 : 0);
}

main().catch(e => {
  console.error("Fatal error running diagnostics:", e);
  process.exit(2);
});
