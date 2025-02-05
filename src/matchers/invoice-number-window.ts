import { Transaction, Invoice } from "../schemas";
import { InvoiceNumberMatcher } from "./invoice-number";

export class InvoiceNumberWindowMatcher extends InvoiceNumberMatcher {
  private offset: number;

  constructor({
    regexString,
    regexFlags,
    offset = 10,
  }: {
    regexString?: string;
    regexFlags?: string;
    offset?: number;
  }) {
    super({ regexString, regexFlags });
    this.offset = offset;
  }

  matchTransactionWithInvoices(
    transaction: Transaction,
    invoices: Invoice[]
  ): Invoice[] {
    const matchedInvoices = super.matchTransactionWithInvoices(
      transaction,
      invoices
    );
    if (matchedInvoices.length > 0) {
      const firstMatchedInvoice = matchedInvoices[0];
      // copy invoices array and sort them by invoiceNumber
      const invoicesCopy = [...invoices];
      invoicesCopy.sort((a, b) =>
        a.invoiceNumber.localeCompare(b.invoiceNumber)
      );
      const indexOfMatchedInvoice = invoicesCopy.indexOf(firstMatchedInvoice);
      const invoicesWindow = invoicesCopy.slice(
        indexOfMatchedInvoice - this.offset,
        indexOfMatchedInvoice + this.offset + 1
      );
      for (const subset of generateSubsets(invoicesWindow)) {
        if (!subset.includes(firstMatchedInvoice)) {
          continue;
        }
        let subsetAmount = subset.reduce(
          (acc, invoice) => acc + invoice.amount,
          0
        );
        if (isSameAmount(Math.abs(transaction.amount), subsetAmount)) {
          subset.sort((a, b) => a.invoiceNumber.localeCompare(b.invoiceNumber));
          return subset;
        }
      }
    }
    return [];
  }
}

// Determine if two amounts can be considered the same:
function isSameAmount(amount1: number, amount2: number) {
  return Math.abs(amount1 - amount2) < 1;
}

// Generate all array subsets (of length 2 or more) for a given array:
function* generateSubsets<T>(array: T[]): Generator<T[]> {
  for (let length = 2; length <= array.length; length++) {
    yield* generateSubsetsOfLength(array, length);
  }
}

function* generateSubsetsOfLength<T>(
  array: T[],
  length: number,
  offset = 0
): Generator<T[]> {
  if (length === 0) {
    yield [];
    return;
  }
  if (offset >= array.length) {
    return;
  }
  for (let i = offset; i <= array.length - length; i++) {
    const first = array[i];
    for (let subset of generateSubsetsOfLength(array, length - 1, i + 1)) {
      subset.push(first);
      yield subset;
    }
  }
}
