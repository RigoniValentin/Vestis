/**
 * Lista los usuarios con rol admin o superadmin en la base de datos.
 *
 * Uso:
 *   npx ts-node-dev --transpile-only -r tsconfig-paths/register \
 *     scripts/list-admin-users.ts
 *
 * Variables de entorno necesarias (.env):
 *   MONGODB_URL_STRING
 */

import "dotenv/config";
import mongoose from "mongoose";
import { exit } from "process";

import { UserModel } from "../src/models/Users";
import { RolesModel } from "../src/models/Roles";

async function main() {
  const mongoUrl = process.env.MONGODB_URL_STRING;
  if (!mongoUrl) {
    console.error("❌ Falta MONGODB_URL_STRING en el .env");
    exit(1);
  }

  console.log(`🔌 Conectando a MongoDB: ${mongoUrl.replace(/\/\/.*@/, "//***@")}`);
  await mongoose.connect(mongoUrl);

  try {
    const adminRoles = await RolesModel.find({
      name: { $in: ["admin", "superadmin"] },
    }).lean();
    const adminRoleIds = adminRoles.map((r) => r._id);

    if (adminRoleIds.length === 0) {
      console.log("⚠️  No hay roles admin/superadmin en la colección Roles.");
      return;
    }

    const admins = await UserModel.find({ roles: { $in: adminRoleIds } })
      .populate("roles", "name")
      .select("name username email roles createdAt subscription deletedAt")
      .sort({ createdAt: 1 })
      .lean();

    if (admins.length === 0) {
      console.log("⚠️  No hay usuarios con rol admin/superadmin.");
      return;
    }

    console.log(
      `\n✅ ${admins.length} usuario(s) admin/superadmin encontrado(s):\n`
    );

    for (const u of admins) {
      const roleNames = (u.roles || []).map((r: any) => r?.name).filter(Boolean);
      const sub = u.subscription as any;
      const subInfo = sub
        ? `${sub.expirationDate
            ? new Date(sub.expirationDate).toISOString().slice(0, 10)
            : "—"}`
        : "—";
      const deleted = u.deletedAt
        ? ` ELIMINADO el ${new Date(u.deletedAt).toISOString().slice(0, 10)}`
        : "";
      console.log(
        `  • ${u.name} | @${u.username} | ${u.email}\n` +
          `      roles: [${roleNames.join(", ")}]\n` +
          `      registrado: ${new Date(
            (u as any).createdAt
          ).toISOString().slice(0, 10)} | vence: ${subInfo}${deleted}\n`
      );
    }
  } finally {
    await mongoose.disconnect();
    console.log("\n🔌 Desconectado.");
  }
}

main().catch((err) => {
  console.error("❌ Error:", err);
  exit(1);
});
