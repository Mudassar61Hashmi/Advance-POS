/**
 * diagnose-login.js
 * Run with: node server/config/diagnose-login.js
 *
 * Tests the exact same steps the login route does, so you can see
 * which step is failing without needing the HTTP layer.
 */
import mongoose  from "mongoose";
import bcrypt    from "bcryptjs";
import dotenv    from "dotenv";
import connectDB from "./db.js";

dotenv.config();

const TEST_USERNAME = "admin";
const TEST_PASSWORD = "admin123";

async function diagnose() {
  console.log("═══════════════════════════════════════");
  console.log("  POS Login Diagnostics");
  console.log("═══════════════════════════════════════\n");

  // ── 1. Connect ──────────────────────────────
  console.log("1️⃣  Connecting to MongoDB…");
  await connectDB();
  console.log("   ✅ Connected\n");

  // ── 2. Raw collection check ──────────────────
  console.log("2️⃣  Checking users collection (raw)…");
  const rawUsers = await mongoose.connection.db
    .collection("users")
    .find({}, { projection: { username: 1, email: 1, role: 1, status: 1, password: 1 } })
    .toArray();

  if (rawUsers.length === 0) {
    console.log("   ❌ No users found! Run: node server/config/seed.js\n");
    process.exit(1);
  }

  console.log(`   Found ${rawUsers.length} user(s):`);
  for (const u of rawUsers) {
    const pwdPreview = u.password ? u.password.slice(0, 7) : "MISSING";
    const isHashed  = u.password?.startsWith("$2b$") || u.password?.startsWith("$2a$");
    console.log(`   • ${u.username} (${u.role}) | status: ${u.status} | pwd: ${pwdPreview}… ${isHashed ? "✅ bcrypt" : "❌ NOT HASHED"}`);
  }
  console.log();

  // ── 3. Find our test user ────────────────────
  console.log(`3️⃣  Looking up user "${TEST_USERNAME}"…`);
  const rawUser = await mongoose.connection.db
    .collection("users")
    .findOne({
      $or: [
        { username: TEST_USERNAME.toLowerCase() },
        { email:    TEST_USERNAME.toLowerCase() },
      ],
    });

  if (!rawUser) {
    console.log(`   ❌ User "${TEST_USERNAME}" not found in DB\n`);
    process.exit(1);
  }
  console.log(`   ✅ Found: ${rawUser.username} | role: ${rawUser.role} | status: ${rawUser.status}\n`);

  // ── 4. Password check ────────────────────────
  console.log(`4️⃣  Testing bcrypt.compare("${TEST_PASSWORD}", hash)…`);
  if (!rawUser.password) {
    console.log("   ❌ password field is empty/missing in the document!\n");
    process.exit(1);
  }

  const isHashed = rawUser.password.startsWith("$2b$") || rawUser.password.startsWith("$2a$");
  if (!isHashed) {
    console.log(`   ❌ Password is NOT hashed! Raw value: "${rawUser.password}"`);
    console.log("   → Pre-save hook didn't fire during seed. Drop DB and re-seed.\n");
    process.exit(1);
  }

  const match = await bcrypt.compare(TEST_PASSWORD, rawUser.password);
  if (!match) {
    console.log(`   ❌ bcrypt.compare returned false`);
    console.log(`   → Hash in DB: ${rawUser.password.slice(0, 20)}…`);
    console.log("   → Password may have been double-hashed. Drop DB and re-seed.\n");

    // Try to detect double-hashing
    const salt    = await bcrypt.genSalt(12);
    const oneHash = await bcrypt.hash(TEST_PASSWORD, salt);
    const double  = await bcrypt.compare(oneHash, rawUser.password);
    if (double) {
      console.log("   ⚠️  DOUBLE-HASH DETECTED — the password was hashed twice.\n");
    }
    process.exit(1);
  }

  console.log("   ✅ Password matches!\n");

  // ── 5. Status check ──────────────────────────
  console.log("5️⃣  Checking account status…");
  if (rawUser.status === "inactive") {
    console.log("   ❌ Account is inactive!\n");
    process.exit(1);
  }
  console.log("   ✅ Account is active\n");

  // ── 6. Summary ───────────────────────────────
  console.log("═══════════════════════════════════════");
  console.log("✅  ALL CHECKS PASSED");
  console.log("   Login should work. If you still get 401,");
  console.log("   the issue is in the HTTP layer (middleware,");
  console.log("   CORS, or a cached old User.js without select:false).");
  console.log("   Make sure you RESTARTED the server after changes.");
  console.log("═══════════════════════════════════════\n");

  process.exit(0);
}

diagnose().catch(err => {
  console.error("Diagnostic error:", err);
  process.exit(1);
});