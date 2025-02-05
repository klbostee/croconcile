import { Invoice } from "../schemas";

export abstract class Destination {
  abstract fetchInvoices(
    cursor?: string
  ): Promise<{ invoices: Invoice[]; cursor?: string }>;

  abstract markInvoiceAsPaid(
    foreignId: string,
    executionDate: string // iso date
  ): Promise<boolean>;
}
