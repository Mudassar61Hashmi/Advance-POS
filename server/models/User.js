import mongoose from "mongoose";
import bcrypt    from "bcryptjs";

const userSchema = new mongoose.Schema({
  name:      { type: String, required: true },
  email:     { type: String, required: true, unique: true, lowercase: true, trim: true },
  username:  { type: String, required: true, unique: true, trim: true },

  // select:false — never returned unless .select("+password") is used
  password:  { type: String, required: true, select: false },

  role: {
    type:    String,
    enum:    ["superadmin", "admin", "manager", "cashier"],
    default: "cashier",
  },
  status:    { type: String, enum: ["active", "inactive"], default: "active" },
  lastLogin: { type: Date, default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

  /* Per-user permission overrides — null/undefined keys defer to the role default */
  permissionOverrides: {
    type: {
      pos:          Boolean,
      inventory:    Boolean,
      salesReports: Boolean,
      customers:    Boolean,
      orders:       Boolean,
      taxes:        Boolean,
      payments:     Boolean,
      userMgmt:     Boolean,
    },
    default: {},
    _id: false,
  },
}, { timestamps: true });

/* ── Hash password before save ──
   Promise-based, no next() parameter — works with all Mongoose versions */
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 12);
});

/* ── Instance method: compare password ── */
userSchema.methods.comparePassword = async function (plain) {
  if (!this.password) {
    throw new Error("Password field not loaded — use .select('+password') when querying");
  }
  return bcrypt.compare(plain, this.password);
};

/* ── Never return password in JSON (belt-and-suspenders) ── */
userSchema.set("toJSON", {
  transform(_, obj) {
    delete obj.password;
    return obj;
  },
});

export const User = mongoose.model("User", userSchema);