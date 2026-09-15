import {
  boolean,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

/** Core user table backing the optional Manus authentication flow. */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const productCategoryValues = [
  "entradas",
  "pratos_principais",
  "sobremesas",
  "bebidas",
  "vinhos",
] as const;

/** Produtos do cardápio, armazenados no MySQL e organizados por categoria. */
export const products = mysqlTable(
  "products",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 160 }).notNull(),
    description: text("description").notNull(),
    priceCents: int("priceCents").notNull(),
    category: mysqlEnum("category", productCategoryValues).notNull(),
    isAvailable: boolean("isAvailable").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("products_category_idx").on(table.category), index("products_name_idx").on(table.name)],
);

export const orderStatusValues = ["finalizado", "cancelado"] as const;

/** Cabeçalho do pedido finalizado pelo cliente. Valores são armazenados em centavos. */
export const orders = mysqlTable(
  "orders",
  {
    id: int("id").autoincrement().primaryKey(),
    orderCode: varchar("orderCode", { length: 24 }).notNull().unique(),
    customerName: varchar("customerName", { length: 120 }).notNull(),
    tableNumber: varchar("tableNumber", { length: 20 }).notNull(),
    serviceChargeEnabled: boolean("serviceChargeEnabled").default(true).notNull(),
    subtotalCents: int("subtotalCents").notNull(),
    serviceChargeCents: int("serviceChargeCents").notNull(),
    totalCents: int("totalCents").notNull(),
    status: mysqlEnum("status", orderStatusValues).default("finalizado").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("orders_table_idx").on(table.tableNumber), index("orders_created_idx").on(table.createdAt)],
);

/** Itens imutáveis do pedido: preservam o preço e o nome praticados no momento da finalização. */
export const orderItems = mysqlTable(
  "order_items",
  {
    id: int("id").autoincrement().primaryKey(),
    orderId: int("orderId").notNull().references(() => orders.id, { onDelete: "cascade" }),
    productId: int("productId").notNull().references(() => products.id),
    productName: varchar("productName", { length: 160 }).notNull(),
    unitPriceCents: int("unitPriceCents").notNull(),
    quantity: int("quantity").notNull(),
    totalCents: int("totalCents").notNull(),
  },
  table => [index("order_items_order_idx").on(table.orderId), index("order_items_product_idx").on(table.productId)],
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type OrderItem = typeof orderItems.$inferSelect;
