import { Matcher } from ".";
import { Invoice, Transaction } from "../schemas";

export class InvoiceNumberMatcher extends Matcher {
  private regex?: RegExp;

  constructor({
    regexString = ".+",
    regexFlags = "g",
  }: {
    regexString?: string;
    regexFlags?: string;
  }) {
    super();
    this.regex = regexString ? new RegExp(regexString, regexFlags) : undefined;
  }

  matchTransactionWithInvoices(
    transaction: Transaction,
    invoices: Invoice[]
  ): Invoice[] {
    if (!transaction.msgIsStructured && transaction.msg) {
      const potentialInvoiceNumbers = this.regex
        ? transaction.msg.match(this.regex)
        : [transaction.msg];
      if (potentialInvoiceNumbers) {
        const matchingInvoices = invoices.filter((invoice) =>
          potentialInvoiceNumbers.some((potentialInvoiceNumber) =>
            invoice.invoiceNumber.endsWith(potentialInvoiceNumber)
          )
        );
        return matchingInvoices;
      }
    }
    return [];
  }
}
