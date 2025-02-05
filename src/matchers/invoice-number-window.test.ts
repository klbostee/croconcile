import { beforeAll, describe, expect, it } from "vitest";
import { Transaction, Invoice } from "../schemas";
import { InvoiceNumberWindowMatcher } from "./invoice-number-window";

describe("InvoiceNumberWindowMatcher", () => {
  let matcher: InvoiceNumberWindowMatcher;

  beforeAll(() => {
    matcher = new InvoiceNumberWindowMatcher({ offset: 5 });
  });

  it("should return an empty array if no invoices match the transaction", () => {
    const transaction: Transaction = {
      amount: 100,
    } satisfies Partial<Transaction> as Transaction;
    const invoices: Invoice[] = [
      { invoiceNumber: "INV-001", amount: 50 },
      { invoiceNumber: "INV-002", amount: 75 },
      { invoiceNumber: "INV-003", amount: 200 },
    ] satisfies Partial<Invoice>[] as Invoice[];

    const result = matcher.matchTransactionWithInvoices(transaction, invoices);

    expect(result).toEqual([]);
  });

  it("should return the matched invoices within the window if the transaction amount matches", () => {
    const transaction: Transaction = {
      amount: 300,
      msg: "INV-002",
    } satisfies Partial<Transaction> as Transaction;
    const invoices: Invoice[] = [
      { invoiceNumber: "INV-001", amount: 50 },
      { invoiceNumber: "INV-002", amount: 75 },
      { invoiceNumber: "INV-003", amount: 200 },
      { invoiceNumber: "INV-004", amount: 100 },
      { invoiceNumber: "INV-005", amount: 125 },
    ] satisfies Partial<Invoice>[] as Invoice[];

    const result = matcher.matchTransactionWithInvoices(transaction, invoices);

    expect(result).toEqual([
      { invoiceNumber: "INV-002", amount: 75 },
      { invoiceNumber: "INV-004", amount: 100 },
      { invoiceNumber: "INV-005", amount: 125 },
    ]);
  });

  it("should return an empty array if no subset of matched invoices has the same amount as the transaction", () => {
    const transaction: Transaction = {
      amount: 3000,
      msg: "INV-002",
    } satisfies Partial<Transaction> as Transaction;
    const invoices: Invoice[] = [
      { invoiceNumber: "INV-001", amount: 50 },
      { invoiceNumber: "INV-002", amount: 75 },
      { invoiceNumber: "INV-003", amount: 200 },
      { invoiceNumber: "INV-004", amount: 100 },
      { invoiceNumber: "INV-005", amount: 125 },
    ] satisfies Partial<Invoice>[] as Invoice[];

    const result = matcher.matchTransactionWithInvoices(transaction, invoices);

    expect(result).toEqual([]);
  });
});
