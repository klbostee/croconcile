import { Matcher } from ".";
import { Invoice, Transaction } from "../schemas";

export class UniqueAmountMatcher extends Matcher {
  matchTransactionWithInvoices(
    transaction: Transaction,
    invoices: Invoice[]
  ): Invoice[] {
    if (transaction.msgIsStructured) {
      return [];
    }
    const absoluteAmount = Math.abs(transaction.amount);
    const transactionDate = new Date(transaction.isoTimestamp);
    const transactionDatePlusOneDay = new Date(
      transactionDate.getTime() + 24 * 60 * 60 * 1000
    );
    const matchingInvoices = invoices.filter(
      (invoice) =>
        invoice.amount === absoluteAmount &&
        // invoice date is at most 1 day after transaction date
        new Date(invoice.invoiceDate) <= transactionDatePlusOneDay
    );
    if (matchingInvoices.length === 1) {
      return matchingInvoices;
    }
    // set of counterpartIdsfor matching invoices
    const matchingCounterpartIds = new Set(
      matchingInvoices.map((invoice) => invoice.counterpartId)
    );
    if (matchingCounterpartIds.size === 1) {
      // return the invoice that is closest to the transaction date when
      // all matching invoices have the same counterpartId
      const invoiceJustBeforeTransaction = matchingInvoices.reduce(
        (prev, curr) => {
          const prevDate = new Date(prev.invoiceDate);
          const currDate = new Date(curr.invoiceDate);
          return Math.abs(currDate.getTime() - transactionDate.getTime()) <
            Math.abs(prevDate.getTime() - transactionDate.getTime())
            ? curr
            : prev;
        },
        matchingInvoices[0]
      );
      return [invoiceJustBeforeTransaction];
    }
    return [];
  }
}
