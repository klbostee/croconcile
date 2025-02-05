import { match } from "assert";
import { z } from "zod";

const ignoreSchema = z.object({
  counterpartNames: z.optional(z.array(z.string())),
});

const destinationConfigSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("airtable"),
    apiKeyEnvVar: z.string(),
    baseId: z.string(),
    tableName: z.string(),
    numberField: z.string(),
    dateField: z.string(),
    totalField: z.string(),
    datePaidField: z.string(),
    statusField: z.string(),
    statusPaidValue: z.string(),
    structuredReferenceField: z.optional(z.string()),
    counterpartIdField: z.string(),
  }),
]);

const matcherConfigSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("structuredReference"),
  }),
  z.object({
    type: z.literal("invoiceNumber"),
    regexString: z.optional(z.string()),
    regexFlags: z.optional(z.string()),
  }),
  z.object({
    type: z.literal("invoiceNumberWindow"),
    regexString: z.optional(z.string()),
    regexFlags: z.optional(z.string()),
    offset: z.optional(z.number()),
  }),
  z.object({
    type: z.literal("uniqueAmount"),
  }),
]);

export const configSchema = z
  .object({
    ignores: z.optional(
      z.object({
        withdrawals: z.optional(ignoreSchema),
        deposits: z.optional(ignoreSchema),
      })
    ),
    sources: z.record(
      z.discriminatedUnion("type", [
        z.object({
          type: z.literal("ponto"),
          clientId: z.string(),
          clientSecretEnvVar: z.string(),
          accountId: z.string(),
        }),
        z.object({
          type: z.literal("paypal"),
          clientId: z.string(),
          clientSecretEnvVar: z.string(),
        }),
      ])
    ),
    destinations: z.object({
      incomingInvoices: destinationConfigSchema,
      outgoingInvoices: destinationConfigSchema,
    }),
    matchers: z.object({
      incomingInvoices: z.array(matcherConfigSchema),
      outgoingInvoices: z.array(matcherConfigSchema),
    }),
  })
  .strict();

export const sourceTypeSchema = z.union([
  z.literal("ponto"),
  z.literal("paypal"),
]);

export const transactionSchema = z.object({
  sourceType: sourceTypeSchema,
  foreignId: z.string(),
  amount: z.number(),
  currency: z.string(),
  msg: z.string(),
  msgIsStructured: z.boolean(),
  isoTimestamp: z.string().datetime(),
  counterpartReference: z.optional(z.string()),
  counterpartName: z.optional(z.string()),
});

export const transactionsSchema = z.array(transactionSchema);

export const invoiceSchema = z.object({
  foreignId: z.string(),
  invoiceNumber: z.string(),
  invoiceDate: z.string().date(),
  amount: z.number(),
  isPaid: z.boolean(),
  structuredReference: z.optional(z.string()),
  counterpartId: z.optional(z.string()),
});

export const invoicesSchema = z.array(invoiceSchema);

export const matchSchema = z.object({
  transaction: transactionSchema,
  invoices: invoicesSchema,
  matcherType: z.string(),
  matchingAmounts: z.boolean(),
});

export const matchesSchema = z.array(matchSchema);

export type Transaction = z.infer<typeof transactionSchema>;
export type Invoice = z.infer<typeof invoiceSchema>;
export type Match = z.infer<typeof matchSchema>;
export type Config = z.infer<typeof configSchema>;
