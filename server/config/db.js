import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const connectDB = async () => {
  let uri = process.env.MONGODB_URI?.trim();
  
  // Handle cases where the env var might be the string "undefined" or "null" or empty
  if (!uri || uri === "undefined" || uri === "null" || uri === "") {
    uri = "mongodb://localhost:27017/propos";
  }
  
  if (!uri.startsWith("mongodb://") && !uri.startsWith("mongodb+srv://")) {
    console.error(`Invalid MongoDB URI scheme: "${uri}". Must start with "mongodb://" or "mongodb+srv://"`);
    process.exit(1);
  }

  try {
    const conn = await mongoose.connect(uri);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
};

export default connectDB;
