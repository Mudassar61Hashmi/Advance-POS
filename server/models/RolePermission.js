import mongoose from "mongoose";

const permissionSchema = new mongoose.Schema({
  pos:          { type: Boolean, default: false },
  inventory:    { type: Boolean, default: false },
  salesReports: { type: Boolean, default: false },
  customers:    { type: Boolean, default: false },
  orders:       { type: Boolean, default: false },
  taxes:        { type: Boolean, default: false },
  payments:     { type: Boolean, default: false },
  userMgmt:     { type: Boolean, default: false },
}, { _id: false });

const rolePermissionSchema = new mongoose.Schema({
  role:        { type: String, required: true, unique: true, trim: true, lowercase: true },
  isSystem:    { type: Boolean, default: false },
  enabled:     { type: Boolean, default: true },
  permissions: { type: permissionSchema, default: () => ({}) },
}, { timestamps: true });

export const RolePermission =
  mongoose.models.RolePermission ||
  mongoose.model("RolePermission", rolePermissionSchema);
