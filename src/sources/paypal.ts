import { Source } from ".";
import { type Transaction, transactionSchema } from "../schemas";

export class PaypalSource extends Source {
  private clientId: string;
  private clientSecret: string;
  private maxPages: number;

  constructor({
    clientId,
    clientSecretEnvVar,
    maxPages = 50,
  }: {
    clientId: string;
    clientSecretEnvVar: string;
    maxPages?: number;
  }) {
    super();
    this.clientId = clientId;
    this.clientSecret = process.env[clientSecretEnvVar]!;
    this.maxPages = maxPages;
  }

  private async obtainAccessToken() {
    const paypalBasicAuth = btoa(`${this.clientId}:${this.clientSecret}`);

    const response = await fetch("https://api.paypal.com/v1/oauth2/token", {
      headers: {
        Accept: "application/json",
        "Accept-Language": "en_US",
        Authorization: `Basic ${paypalBasicAuth}`,
      },
      method: "POST",
      body: new URLSearchParams({ grant_type: "client_credentials" }),
    });
    const result = await response.json();

    return result.access_token as string;
  }

  async fetchTransactions(cursor?: string) {
    const paypalAccessToken = await this.obtainAccessToken();

    const rangeIndex = cursor ? parseInt(cursor) : 1;

    const now = new Date();
    const url = `https://api.paypal.com/v1/reporting/transactions?start_date=${new Date(
      now.setMonth(now.getMonth() - rangeIndex)
    ).toISOString()}&end_date=${new Date(
      now.setMonth(now.getMonth() + 1)
    ).toISOString()}&fields=all`;

    const transactions: Transaction[] = [];
    for (let pageNr = 1; pageNr <= this.maxPages; pageNr++) {
      const response = await fetch(`${url}&page=${pageNr}`, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${paypalAccessToken}`,
        },
      });
      const data = await response.json();
      for (const datum of data.transaction_details) {
        const transactionInfo = datum.transaction_info;
        const payerInfo = datum.payer_info;
        const cartInfo = datum.cart_info;

        const transactionAmount = parseFloat(
          transactionInfo.transaction_amount.value
        );
        if (transactionAmount < 0) {
          continue;
        }

        const feeAmount = parseFloat(transactionInfo.fee_amount.value);

        transactions.push(
          transactionSchema.parse({
            sourceType: "paypal",
            foreignId: transactionInfo.transaction_id,
            amount: transactionAmount + feeAmount,
            currency: transactionInfo.transaction_amount.currency_code,
            msg: cartInfo.item_details
              .filter((i: any) => i.item_code)
              .map((i: any) => i.item_code)
              .join(","),
            msgIsStructured: false,
            isoTimestamp: new Date(
              transactionInfo.transaction_initiation_date
            ).toISOString(),
            counterpartReference: payerInfo.account_id,
            counterpartName: payerInfo.payer_name.alternate_full_name,
          })
        );
      }
      if (data.total_items < 100) {
        break;
      }
    }
    return {
      transactions,
      cursor: rangeIndex < 3 ? String(rangeIndex + 1) : undefined,
    };
  }
}
