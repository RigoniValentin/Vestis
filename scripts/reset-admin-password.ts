/**
 * Resetea la contraseña de un usuario admin.
 *
 * Uso:
 *   npx ts-node-dev --transpile-only -r tsconfig-paths/register \
 *     scripts/reset-admin-password.ts --email=<email> --password=<nueva>
 */

import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { argv, exit } from "process";

import { UserModel } from "../src/models/Users";

type CliArgs = { email?: string; password?: string };

function parseArgs(): CliArgs {
  const out: CliArgs = {};
  for (const a of argv.slice(2)) {
    if (a.startsWith("--email=")) out.email = a.split("=")[1];
    if (a.startsWith("--password=")) out.password = a.split("=")[1];
  }
  return out;
}

async function main() {
  const args = parseArgs();
  if (!args.email || !args.password) {
    console.error("❌ Faltan argumentos. Uso:");
    console.error(
      "   --email=<email> --password=<nueva contraseña (mín 6 chars)>"
    );
    exit(1);
  }
  if (args.password.length < 6) {
    console.error("❌ La contraseña debe tener al menos 6 caracteres.");
    exit(1);
  }

  const mongoUrl = process.env.MONGODB_URL_STRING;
  if (!mongoUrl) {
    console.error("❌ Falta MONGODB_URL_STRING en el .env");
    exit(1);
  }

  console.log(`🔌 Conectando a MongoDB…`);
  await mongoose.connect(mongoUrl);

  try {
    const user = await UserModel.findOne({ email: args.email });
    if (!user) {
      console.error(`❌ No existe un usuario con email ${args.email}`);
      exit(1);
    }

    if (user.deletedAt) {
      console.warn(
        `⚠️  El usuario está soft-deleted. Lo restauramos para poder operar.`
      );
      user.deletedAt = null as any;
      user.deletedBy = null as any;
    }

    const salt = await bcrypt.genSalt(12);
    const hashed = await bcrypt.hash(args.password!, salt);
    // Usamos findOneAndUpdate en lugar de user.save() para NO disparar
    // el pre('save') hook que volvería a hashear.
    await UserModel.findByIdAndUpdate(user._id, {
      $set: { password: hashed },
    });

    console.log(
      `\n✅ Contraseña reseteada para ${user.email} (${user.name} @${user.username})`
    );
    console.log(`   Nueva contraseña: ${args.password}`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error("❌ Error:", err);
  exit(1);
});
