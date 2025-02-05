import { Invoice, Transaction } from "../schemas";

export abstract class Matcher {
  abstract matchTransactionWithInvoices(
    transaction: Transaction,
    invoices: Invoice[]
  ): Invoice[];
}
