import path from "path";
import fs from "fs";
import dotenv from "dotenv";

const possiblePaths = [
  // Electron packaged backend
  path.join(process.cwd(), ".env"),

  // Development
  path.join(__dirname, "../../.env")
];

for (const envPath of possiblePaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    console.log("Loaded .env:", envPath);
    break;
  }
}