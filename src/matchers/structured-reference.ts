import { Matcher } from ".";
import { Invoice, Transaction } from "../schemas";
import { normalizeStructuredReference } from "../utils";

export class StructuredReferenceMatcher extends Matcher {
  matchTransactionWithInvoices(
    transaction: Transaction,
    invoices: Invoice[]
  ): Invoice[] {
    const normalizedStructuredReference = normalizeStructuredReference(
      transaction.msg
    );
    const matchingInvoice = invoices.find(
      (invoice) => invoice.structuredReference === normalizedStructuredReference
    );
    if (matchingInvoice) {
      return [matchingInvoice];
    }
    return [];
  }
}
