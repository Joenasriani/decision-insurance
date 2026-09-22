"use client";

import { openDB } from "idb";
import type { Examination } from "@/types/core";

const DB_NAME = "decision_insurance";
const STORE = "examinations";

async function db() {
  return openDB(DB_NAME, 1, {
    upgrade(database) {
      if (!database.objectStoreNames.contains(STORE)) {
        database.createObjectStore(STORE, { keyPath: "id" });
      }
    }
  });
}

export async function saveExamination(value: Examination) {
  const database = await db();
  await database.put(STORE, value);
}

export async function loadExaminations(): Promise<Examination[]> {
  const database = await db();
  return database.getAll(STORE);
}
