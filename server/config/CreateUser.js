/**
 * CreateUser.js
 * ─────────────────────────────────────────────────────────────
 * Run with:  node server/config/CreateUser.js
 *
 * Uses the REAL User model (with bcrypt pre-save hook) so passwords
 * are properly hashed — identical to what the login route expects.
 * ─────────────────────────────────────────────────────────────
 */
import mongoose  from "mongoose";
import bcrypt    from "bcryptjs";
import dotenv    from "dotenv";

dotenv.config();

const MONGO_URI = process.env.MONGODB_URI?.trim() || "mongodb://localhost:27017/propos";

/* ── Use the REAL schema (must match models/User.js exactly) ── */
const userSchema = new mongoose.Schema({
  name:      { type: String, required: true },
  email:     { type: String, required: true, unique: true, lowercase: true, trim: true },
  username:  { type: String, required: true, unique: true, trim: true },
  password:  { type: String, required: true, select: false },   // ✅ select:false
  role: {
    type:    String,
    enum:    ["superadmin", "admin", "manager", "cashier"],
    default: "cashier",
  },
  status:    { type: String, enum: ["active", "inactive"], default: "active" },
  lastLogin: { type: Date, default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
}, { timestamps: true });

/* ── Hash password before save — NO next(), promise-based ── */
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 12);
});

const User = mongoose.model("User", userSchema);

/* ── Users to create ── */
const USERS = [
  {
    name:     "Super Admin",
    username: "superadmin",
    email:    "superadmin@pos.com",
    password: "super123",
    role:     "superadmin",
  },
  {
    name:     "Admin User",
    username: "admin",
    email:    "admin@pos.com",
    password: "admin123",
    role:     "admin",
  },
  {
    name:     "Store Manager",
    username: "manager",
    email:    "manager@pos.com",
    password: "manager123",
    role:     "manager",
  },
  {
    name:     "Cashier One",
    username: "cashier",
    email:    "cashier@pos.com",
    password: "cashier123",
    role:     "cashier",
  },
];

const createUsers = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log(`✅ Connected to MongoDB: ${mongoose.connection.host}`);

    /* Drop only the users collection so products/customers are untouched */
    await User.deleteMany({});
    console.log("🗑️  Cleared existing users\n");

    /* Create users one-by-one so the pre-save hook fires for each */
    for (const u of USERS) {
      await User.create(u);
      console.log(`   ✅ Created: ${u.username.padEnd(12)} (${u.role})`);
    }

    /* Verify passwords were hashed */
    console.log("\n🔍 Verifying bcrypt hashes in DB…");
    const raw = await mongoose.connection.db
      .collection("users")
      .find({}, { projection: { username: 1, password: 1 } })
      .toArray();

    let allGood = true;
    for (const u of raw) {
      const hashed = u.password?.startsWith("$2b$") || u.password?.startsWith("$2a$");
      console.log(`   ${hashed ? "✅" : "❌"} ${u.username}: ${u.password?.slice(0, 20)}…`);
      if (!hashed) allGood = false;
    }

    if (!allGood) {
      console.log("\n❌ Some passwords are NOT hashed — pre-save hook failed!");
      process.exit(1);
    }

    console.log("\n✅ All passwords are bcrypt hashed (cost factor 12)");
    console.log("─────────────────────────────────────");
    console.log("   superadmin / super123");
    console.log("   admin      / admin123");
    console.log("   manager    / manager123");
    console.log("   cashier    / cashier123");
    console.log("─────────────────────────────────────");
    console.log("\n🚀 Ready — restart your server and log in!\n");

  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
    process.exit(0);
  }
};

createUsers();