import { Destination } from ".";
import { invoiceSchema } from "../schemas";
import { normalizeStructuredReference } from "../utils";

export class AirtableDestination extends Destination {
  private baseId: string;
  private tableName: string;
  private apiKey: string;
  private numberField: string;
  private dateField: string;
  private totalField: string;
  private datePaidField: string;
  private statusField: string;
  private statusPaidValue: string;
  private structuredReferenceField?: string;
  private counterpartIdField: string;

  constructor({
    baseId,
    tableName,
    apiKeyEnvVar,
    numberField,
    dateField,
    totalField,
    datePaidField,
    statusField,
    statusPaidValue,
    structuredReferenceField,
    counterpartIdField,
  }: {
    baseId: string;
    tableName: string;
    apiKeyEnvVar: string;
    numberField: string;
    dateField: string;
    totalField: string;
    datePaidField: string;
    statusField: string;
    statusPaidValue: string;
    structuredReferenceField?: string;
    counterpartIdField: string;
  }) {
    super();
    this.baseId = baseId;
    this.tableName = tableName;
    this.apiKey = process.env[apiKeyEnvVar]!;
    this.numberField = numberField;
    this.dateField = dateField;
    this.totalField = totalField;
    this.datePaidField = datePaidField;
    this.statusField = statusField;
    this.statusPaidValue = statusPaidValue;
    this.structuredReferenceField = structuredReferenceField;
    this.counterpartIdField = counterpartIdField;
  }

  async fetchInvoices(cursor?: string) {
    const baseUrl = `https://api.airtable.com/v0/${this.baseId}/${this.tableName}`;
    const url = cursor ? `${baseUrl}?offset=${cursor}` : baseUrl;

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
    });
    const result = await response.json();

    const requiredKeys = new Set([
      this.numberField,
      this.dateField,
      this.totalField,
      this.statusField,
    ]);
    if (this.structuredReferenceField) {
      requiredKeys.add(this.structuredReferenceField);
    }

    const records = result.records as any[];
    const invoices = records
      .filter((record) => {
        return [...requiredKeys].every(
          (requiredKey) => requiredKey in record.fields
        );
      })
      .map((record) => {
        const fields = record.fields;

        let structuredReference = this.structuredReferenceField
          ? fields[this.structuredReferenceField]
          : undefined;
        if (structuredReference) {
          structuredReference =
            normalizeStructuredReference(structuredReference);
        }

        return invoiceSchema.parse({
          foreignId: record.id,
          invoiceNumber: fields[this.numberField],
          invoiceDate: fields[this.dateField],
          amount: fields[this.totalField],
          isPaid: fields[this.statusField] === this.statusPaidValue,
          structuredReference,
          counterpartId: fields[this.counterpartIdField]?.toString(),
        });
      });

    const offset = result.offset;
    const nextCursor = offset ? (offset as string) : undefined;
    return { invoices, cursor: nextCursor };
  }

  async markInvoiceAsPaid(foreignId: string, executionDate: string) {
    const response = await fetch(
      `https://api.airtable.com/v0/${this.baseId}/${this.tableName}/${foreignId}`,
      {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        method: "PATCH",
        body: JSON.stringify({
          fields: {
            [this.statusField]: this.statusPaidValue,
            [this.datePaidField]: executionDate.slice(0, 10),
          },
        }),
      }
    );
    return response.status === 200;
  }
}
