import mongoose  from "mongoose";
import { User }   from "../models/User.js";
import { Product} from "../models/Product.js";
import { Customer}from "../models/Customer.js";
import connectDB  from "./db.js";

const seed = async () => {
  await connectDB();

  await User.deleteMany({});
  await Product.deleteMany({});
  await Customer.deleteMany({});

  /* Passwords are plain here — the pre-save hook hashes them automatically */
  await User.create([
    { name: "Super Admin", username: "superadmin", email: "superadmin@pos.com", password: "super123",   role: "superadmin" },
    { name: "Admin User",  username: "admin",       email: "admin@pos.com",      password: "admin123",   role: "admin"      },
    { name: "Store Manager",username: "manager",    email: "manager@pos.com",    password: "manager123", role: "manager"    },
    { name: "Cashier One", username: "cashier",     email: "cashier@pos.com",    password: "cashier123", role: "cashier"    },
  ]);

  await Customer.create([
    { name: "Walk-in Customer", phone: "0000000000", isDefault: true },
  ]);

  await Product.create([
    { name: "Apple",        price: 0.5,  quantity: 100, category: "Fruits",       barcode: "1001", lowStockThreshold: 20 },
    { name: "Milk 1L",      price: 1.2,  quantity: 50,  category: "Dairy",        barcode: "1002", lowStockThreshold: 10 },
    { name: "Bread",        price: 2.0,  quantity: 30,  category: "Bakery",       barcode: "1003", lowStockThreshold: 10 },
    { name: "Orange Juice", price: 3.5,  quantity: 40,  category: "Beverages",    barcode: "1004", lowStockThreshold: 10 },
    { name: "Eggs (12pk)",  price: 4.0,  quantity: 60,  category: "Dairy",        barcode: "1005", lowStockThreshold: 15 },
    { name: "Butter",       price: 2.5,  quantity: 8,   category: "Dairy",        barcode: "1006", lowStockThreshold: 10 },
    { name: "Rice 1kg",     price: 1.8,  quantity: 80,  category: "Grains",       barcode: "1007", lowStockThreshold: 20 },
    { name: "Chicken",      price: 6.0,  quantity: 5,   category: "Meat",         barcode: "1008", lowStockThreshold: 10 },
  ]);

  console.log("✅ Database seeded!");
  console.log("   superadmin / super123");
  console.log("   admin      / admin123");
  console.log("   manager    / manager123");
  console.log("   cashier    / cashier123");
  console.log("   ⚠️  Passwords are bcrypt hashed in the database");
  process.exit();
};

seed();