/**
 * Asigna la posicion (campo "order") a los contenidos de lentes que todavia
 * no la tienen, respetando el orden en que se ven hoy (fijados primero y luego
 * los mas recientes). Es una operacion de un solo uso: se puede volver a correr
 * sin romper nada porque solo toca los documentos sin "order".
 *
 * Uso:
 *   npx ts-node-dev --transpile-only -r tsconfig-paths/register \
 *     scripts/backfill-lens-content-order.ts
 *
 * Variables de entorno necesarias (.env):
 *   MONGODB_URL_STRING
 */

import "dotenv/config";
import mongoose from "mongoose";
import { exit } from "process";

import { LensContentModel } from "../src/models/LensContent";

async function main() {
  const mongoUrl = process.env.MONGODB_URL_STRING;
  if (!mongoUrl) {
    console.error("❌ Falta MONGODB_URL_STRING en el .env");
    exit(1);
  }

  console.log(
    `🔌 Conectando a MongoDB: ${mongoUrl.replace(/\/\/.*@/, "//***@")}`
  );
  await mongoose.connect(mongoUrl);

  try {
    const pending = await LensContentModel.find({
      $or: [{ order: { $exists: false } }, { order: null }],
    })
      .sort({ isPinned: -1, createdAt: -1 })
      .lean<{ _id: mongoose.Types.ObjectId; title: string }>();

    if (pending.length === 0) {
      console.log("✅ Todos los contenidos de lentes ya tienen posición.");
      return;
    }

    console.log(`\n🛠  Actualizando ${pending.length} contenido(s)...\n`);

    const operations = pending.map((item, index) => ({
      updateOne: {
        filter: { _id: item._id },
        update: { $set: { order: index } },
      },
    }));

    const result = await LensContentModel.bulkWrite(operations);

    console.log(
      `✅ Listo: ${result.modifiedCount} documento(s) con posición asignada.`
    );
  } finally {
    await mongoose.disconnect();
    console.log("\n🔌 Desconectado.");
  }
}

main().catch((err) => {
  console.error("❌ Error:", err);
  exit(1);
});
