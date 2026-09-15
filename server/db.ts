import { and, asc, count, eq, inArray, like } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  type InsertUser,
  type NewProduct,
  orderItems,
  orders,
  paymentMethodValues,
  products,
  type Product,
  users,
} from "../drizzle/schema";
import { catalogSeed, type CatalogSeedItem } from "../shared/catalogSeed";
import { calculateChangeCents, calculateOrderTotals } from "./orderCalculations";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

/** Lazily creates the Drizzle/MySQL client so local type checks remain independent of the database. */
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;

  for (const field of textFields) {
    if (user[field] !== undefined) {
      const normalized = user[field] ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    }
  }

  values.lastSignedIn = user.lastSignedIn ?? new Date();
  updateSet.lastSignedIn = values.lastSignedIn;
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

/** Idempotently seeds the mandatory 150-product restaurant catalog on first access. */
export async function seedCatalogIfNeeded() {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");

  const [countRow] = await db.select({ total: count() }).from(products);
  if ((countRow?.total ?? 0) >= catalogSeed.length) return;

  const names = catalogSeed.map(item => item.name);
  const existingRows = names.length
    ? await db.select({ name: products.name }).from(products).where(inArray(products.name, names))
    : [];
  const existingNames = new Set(existingRows.map(row => row.name));
  const missing = catalogSeed.filter(item => !existingNames.has(item.name));

  if (missing.length) {
    await db.insert(products).values(missing as NewProduct[]);
  }
}

export async function listProducts(input?: {
  category?: CatalogSeedItem["category"];
  search?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  await seedCatalogIfNeeded();

  const conditions = [eq(products.isAvailable, true)];
  if (input?.category) conditions.push(eq(products.category, input.category));
  if (input?.search?.trim()) conditions.push(like(products.name, `%${input.search.trim()}%`));

  return db
    .select()
    .from(products)
    .where(and(...conditions))
    .orderBy(asc(products.category), asc(products.name));
}

export async function getCatalogCounts() {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  await seedCatalogIfNeeded();
  const data = await db.select().from(products).where(eq(products.isAvailable, true));
  return data.reduce<Record<string, number>>((acc, product) => {
    acc[product.category] = (acc[product.category] ?? 0) + 1;
    return acc;
  }, {});
}

export type SubmittedOrderItem = { productId: number; quantity: number };
export type PaymentMethod = (typeof paymentMethodValues)[number];

/**
 * Builds totals from live MySQL prices, stores a completed order and immutable line snapshots.
 * Client-provided monetary values are intentionally ignored.
 */
export async function createOrder(input: {
  customerName: string;
  tableNumber: string;
  paymentMethod: PaymentMethod;
  needsChange: boolean;
  cashReceivedCents?: number | null;
  serviceChargeEnabled: boolean;
  items: SubmittedOrderItem[];
}) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");

  const normalizedItems = input.items
    .filter(item => Number.isInteger(item.productId) && Number.isInteger(item.quantity) && item.quantity > 0)
    .reduce<SubmittedOrderItem[]>((acc, item) => {
      const current = acc.find(line => line.productId === item.productId);
      if (current) current.quantity += item.quantity;
      else acc.push({ ...item });
      return acc;
    }, []);

  if (!normalizedItems.length) throw new Error("Adicione ao menos um produto ao pedido.");

  const productRows = await db
    .select()
    .from(products)
    .where(and(inArray(products.id, normalizedItems.map(item => item.productId)), eq(products.isAvailable, true)));

  if (productRows.length !== normalizedItems.length) {
    throw new Error("Um ou mais produtos não estão mais disponíveis.");
  }

  const productById = new Map(productRows.map(product => [product.id, product]));
  const pricedLines = normalizedItems.map(item => {
    const product = productById.get(item.productId);
    if (!product) throw new Error("Produto inválido.");
    return { product, quantity: item.quantity };
  });
  const totals = calculateOrderTotals(
    pricedLines.map(line => ({ unitPriceCents: line.product.priceCents, quantity: line.quantity })),
    input.serviceChargeEnabled,
  );
  const isCashPayment = input.paymentMethod === "dinheiro";
  const cashReceivedCents = isCashPayment && input.cashReceivedCents != null ? input.cashReceivedCents : null;
  if (input.needsChange && !isCashPayment) {
    throw new Error("A opção de troco está disponível somente para pagamentos em dinheiro.");
  }
  if (input.needsChange && (cashReceivedCents == null || cashReceivedCents < totals.totalCents)) {
    throw new Error("Informe um valor em dinheiro igual ou maior que o total do pedido.");
  }
  const changeCents = calculateChangeCents(totals.totalCents, cashReceivedCents, input.needsChange);
  const orderCode = `SM-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;

  return db.transaction(async tx => {
    const [orderResult] = await tx.insert(orders).values({
      orderCode,
      customerName: input.customerName.trim(),
      tableNumber: input.tableNumber.trim(),
      paymentMethod: input.paymentMethod,
      needsChange: input.needsChange,
      cashReceivedCents,
      changeCents,
      serviceChargeEnabled: input.serviceChargeEnabled,
      ...totals,
    });
    const orderId = orderResult.insertId;

    await tx.insert(orderItems).values(
      pricedLines.map(({ product, quantity }) => ({
        orderId,
        productId: product.id,
        productName: product.name,
        unitPriceCents: product.priceCents,
        quantity,
        totalCents: product.priceCents * quantity,
      })),
    );

    return {
      id: orderId,
      orderCode,
      customerName: input.customerName.trim(),
      tableNumber: input.tableNumber.trim(),
      paymentMethod: input.paymentMethod,
      needsChange: input.needsChange,
      cashReceivedCents,
      changeCents,
      serviceChargeEnabled: input.serviceChargeEnabled,
      ...totals,
      items: pricedLines.map(({ product, quantity }) => ({
        productId: product.id,
        productName: product.name,
        unitPriceCents: product.priceCents,
        quantity,
        totalCents: product.priceCents * quantity,
      })),
    };
  });
}

export type { Product };
