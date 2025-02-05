import { StructuredReferenceMatcher } from "./structured-reference";
import { Invoice, Transaction } from "../schemas";
import { beforeAll, describe, expect, it } from "vitest";

describe("StructuredReferenceMatcher", () => {
  let matcher: StructuredReferenceMatcher;

  beforeAll(() => {
    matcher = new StructuredReferenceMatcher();
  });

  it("should return an empty array if the transaction message is empty", () => {
    const transaction: Transaction = {
      msgIsStructured: true,
      msg: "",
    } satisfies Partial<Transaction> as Transaction;
    const invoices: Invoice[] = [
      { structuredReference: "9876543210", amount: 50 },
      { structuredReference: "1234567890", amount: 75 },
      { structuredReference: "5555555555", amount: 200 },
    ] satisfies Partial<Invoice>[] as Invoice[];

    const result = matcher.matchTransactionWithInvoices(transaction, invoices);

    expect(result).toEqual([]);
  });

  it("should return an empty array if the transaction message does not match any invoice structured reference", () => {
    const transaction: Transaction = {
      msgIsStructured: true,
      msg: "9999999999",
    } satisfies Partial<Transaction> as Transaction;
    const invoices: Invoice[] = [
      { structuredReference: "9876543210", amount: 50 },
      { structuredReference: "1234567890", amount: 75 },
      { structuredReference: "5555555555", amount: 200 },
    ] satisfies Partial<Invoice>[] as Invoice[];

    const result = matcher.matchTransactionWithInvoices(transaction, invoices);

    expect(result).toEqual([]);
  });

  it("should return the matching invoice if the transaction message matches an invoice structured reference", () => {
    const transaction: Transaction = {
      msg: "1234567890",
    } satisfies Partial<Transaction> as Transaction;
    const invoices: Invoice[] = [
      { structuredReference: "9876543210", amount: 50 },
      { structuredReference: "1234567890", amount: 75 },
      { structuredReference: "5555555555", amount: 200 },
    ] satisfies Partial<Invoice>[] as Invoice[];

    const result = matcher.matchTransactionWithInvoices(transaction, invoices);

    expect(result).toEqual([{ structuredReference: "1234567890", amount: 75 }]);
  });
});
