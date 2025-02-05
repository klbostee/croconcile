import { beforeAll, describe, expect, it } from "vitest";
import { InvoiceNumberMatcher } from "./invoice-number";
import { Invoice, Transaction } from "../schemas";

describe("InvoiceNumberMatcher", () => {
  let matcher: InvoiceNumberMatcher;

  beforeAll(() => {
    matcher = new InvoiceNumberMatcher({ regexString: "INV-\\d+" });
  });

  it("should return an empty array if the transaction message is structured", () => {
    const transaction = {
      msgIsStructured: true,
      msg: "INV-001",
    } satisfies Partial<Transaction> as Transaction;
    const invoices = [
      { invoiceNumber: "INV-001", amount: 50 },
      { invoiceNumber: "INV-002", amount: 75 },
      { invoiceNumber: "INV-003", amount: 200 },
    ] satisfies Partial<Invoice>[] as Invoice[];

    const result = matcher.matchTransactionWithInvoices(transaction, invoices);

    expect(result).toEqual([]);
  });

  it("should return an empty array if the transaction message is empty", () => {
    const transaction = {
      msgIsStructured: false,
      msg: "",
    } satisfies Partial<Transaction> as Transaction;
    const invoices = [
      { invoiceNumber: "INV-001", amount: 50 },
      { invoiceNumber: "INV-002", amount: 75 },
      { invoiceNumber: "INV-003", amount: 200 },
    ] satisfies Partial<Invoice>[] as Invoice[];

    const result = matcher.matchTransactionWithInvoices(transaction, invoices);

    expect(result).toEqual([]);
  });

  it("should return an empty array if the transaction message does not match any invoice number", () => {
    const transaction = {
      msgIsStructured: false,
      msg: "INV-004",
    } satisfies Partial<Transaction> as Transaction;
    const invoices = [
      { invoiceNumber: "INV-001", amount: 50 },
      { invoiceNumber: "INV-002", amount: 75 },
      { invoiceNumber: "INV-003", amount: 200 },
    ] satisfies Partial<Invoice>[] as Invoice[];

    const result = matcher.matchTransactionWithInvoices(transaction, invoices);

    expect(result).toEqual([]);
  });

  it("should return the matching invoice if the transaction message matches an invoice number", () => {
    const transaction = {
      msgIsStructured: false,
      msg: "INV-002",
    } satisfies Partial<Transaction> as Transaction;
    const invoices = [
      { invoiceNumber: "INV-001", amount: 50 },
      { invoiceNumber: "INV-002", amount: 75 },
      { invoiceNumber: "INV-003", amount: 200 },
    ] satisfies Partial<Invoice>[] as Invoice[];

    const result = matcher.matchTransactionWithInvoices(transaction, invoices);

    expect(result).toEqual([{ invoiceNumber: "INV-002", amount: 75 }]);
  });

  it("should return multiple matching invoices if the transaction message matches multiple invoice numbers", () => {
    const transaction = {
      msgIsStructured: false,
      msg: "INV-002 INV-003",
    } satisfies Partial<Transaction> as Transaction;
    const invoices = [
      { invoiceNumber: "INV-001", amount: 50 },
      { invoiceNumber: "INV-002", amount: 75 },
      { invoiceNumber: "INV-003", amount: 200 },
    ] satisfies Partial<Invoice>[] as Invoice[];

    const result = matcher.matchTransactionWithInvoices(transaction, invoices);

    expect(result).toEqual([
      { invoiceNumber: "INV-002", amount: 75 },
      { invoiceNumber: "INV-003", amount: 200 },
    ]);
  });
});
