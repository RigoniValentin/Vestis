import "dotenv/config";
import mongoose from "mongoose";
import { exit } from "process";
import { UserModel } from "../src/models/Users";

async function main() {
  const email = process.argv[2];
  const password = process.argv[3];
  if (!email || !password) {
    console.error("Uso: ts-node-dev scripts/test-login.ts <email> <password>");
    exit(1);
  }

  const mongoUrl = process.env.MONGODB_URL_STRING;
  if (!mongoUrl) {
    console.error("Falta MONGODB_URL_STRING");
    exit(1);
  }
  await mongoose.connect(mongoUrl);
  try {
    const user = await UserModel.findOne({ email });
    if (!user) {
      console.error(`❌ No existe el usuario con email ${email}`);
      return;
    }
    console.log(`Usuario: ${user.name} @${user.username} (${user.email})`);
    console.log(`deletedAt:`, user.deletedAt);
    console.log(`roles:`,
      (user.roles || []).map((r: any) => (r?.name || r)).join(", ")
    );
    const ok = await user.comparePassword(password);
    console.log(`comparePassword("${password}") =>`, ok);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  exit(1);
});
