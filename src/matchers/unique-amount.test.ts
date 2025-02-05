import { UniqueAmountMatcher } from "./unique-amount";
import { Invoice, Transaction } from "../schemas";
import { beforeAll, describe, expect, it } from "vitest";

describe("UniqueAmountMatcher", () => {
  let matcher: UniqueAmountMatcher;

  beforeAll(() => {
    matcher = new UniqueAmountMatcher();
  });

  it("should return an empty array if there are no matching invoices", () => {
    const transaction: Transaction = {
      amount: 100,
      isoTimestamp: "2022-01-01T00:00:00Z",
    } satisfies Partial<Transaction> as Transaction;
    const invoices: Invoice[] = [
      { amount: 50, counterpartId: "C1", invoiceDate: "2021-12-01" },
      { amount: 75, counterpartId: "C2", invoiceDate: "2021-12-15" },
      { amount: 200, counterpartId: "C3", invoiceDate: "2021-12-31" },
    ] satisfies Partial<Invoice>[] as Invoice[];

    const result = matcher.matchTransactionWithInvoices(transaction, invoices);

    expect(result).toEqual([]);
  });

  it("should return the matching invoice if there is a single matching invoice", () => {
    const transaction: Transaction = {
      amount: 75,
      isoTimestamp: "2022-01-01T00:00:00Z",
    } satisfies Partial<Transaction> as Transaction;
    const invoices: Invoice[] = [
      { amount: 50, counterpartId: "C1", invoiceDate: "2021-12-01" },
      { amount: 75, counterpartId: "C2", invoiceDate: "2021-12-15" },
      { amount: 200, counterpartId: "C3", invoiceDate: "2021-12-31" },
    ] satisfies Partial<Invoice>[] as Invoice[];

    const result = matcher.matchTransactionWithInvoices(transaction, invoices);

    expect(result).toEqual([
      { amount: 75, counterpartId: "C2", invoiceDate: "2021-12-15" },
    ]);
  });

  it("should return the invoice just before the transaction date if multiple matching invoices have the same counterpartId", () => {
    const transaction: Transaction = {
      amount: 200,
      isoTimestamp: "2021-12-16T00:00:00Z",
    } satisfies Partial<Transaction> as Transaction;
    const invoices: Invoice[] = [
      { amount: 200, counterpartId: "C2", invoiceDate: "2021-12-01" },
      { amount: 200, counterpartId: "C2", invoiceDate: "2021-12-15" },
      { amount: 200, counterpartId: "C2", invoiceDate: "2021-12-31" },
    ] satisfies Partial<Invoice>[] as Invoice[];

    const result = matcher.matchTransactionWithInvoices(transaction, invoices);

    expect(result).toEqual([
      { amount: 200, counterpartId: "C2", invoiceDate: "2021-12-15" },
    ]);
  });

  it("should return an empty array if multiple matching invoices have different counterpartIds", () => {
    const transaction: Transaction = {
      amount: 200,
      isoTimestamp: "2022-01-01T00:00:00Z",
    } satisfies Partial<Transaction> as Transaction;
    const invoices: Invoice[] = [
      { amount: 50, counterpartId: "C1", invoiceDate: "2021-12-01" },
      { amount: 200, counterpartId: "C2", invoiceDate: "2021-12-15" },
      { amount: 200, counterpartId: "C3", invoiceDate: "2021-12-31" },
    ] satisfies Partial<Invoice>[] as Invoice[];

    const result = matcher.matchTransactionWithInvoices(transaction, invoices);

    expect(result).toEqual([]);
  });
});
