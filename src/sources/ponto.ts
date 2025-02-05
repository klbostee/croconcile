import { Source } from ".";
import { type Transaction, transactionSchema } from "../schemas";
import { normalizeStructuredReference } from "../utils";

export class PontoSource extends Source {
  private clientId: string;
  private clientSecret: string;
  private accountId: string;

  constructor({
    clientId,
    clientSecretEnvVar,
    accountId,
  }: {
    clientId: string;
    clientSecretEnvVar: string;
    accountId: string;
  }) {
    super();
    this.clientId = clientId;
    this.clientSecret = process.env[clientSecretEnvVar]!;
    this.accountId = accountId;
  }

  private async obtainAccessToken() {
    const pontoBasicAuth = btoa(`${this.clientId}:${this.clientSecret}`);

    const response = await fetch("https://api.myponto.com/oauth2/token", {
      headers: {
        Accept: "application/json",
        Authorization: `Basic ${pontoBasicAuth}`,
      },
      method: "POST",
      body: new URLSearchParams({ grant_type: "client_credentials" }),
    });
    const result = await response.json();

    return result.access_token as string;
  }

  async fetchTransactions(cursor?: string) {
    const pontoAccessToken = await this.obtainAccessToken();

    const params = new URLSearchParams({ limit: "50" });
    if (cursor) {
      params.append("after", cursor);
    }
    const url = `https://api.myponto.com/accounts/${this.accountId}/transactions?${params}`;
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${pontoAccessToken}`,
      },
    });
    const data = await response.json();

    const transactions: Transaction[] = data.data.map((datum: any) => {
      const attributes = datum.attributes;
      let msg = attributes.remittanceInformation;
      const msgIsStructured =
        attributes.remittanceInformationType === "structured";
      if (msgIsStructured) {
        msg = normalizeStructuredReference(msg);
      }
      return transactionSchema.parse({
        sourceType: "ponto",
        foreignId: datum.id,
        amount: attributes.amount,
        currency: attributes.currency,
        msg: msg || "",
        msgIsStructured,
        isoTimestamp: attributes.executionDate,
        counterpartReference: attributes.counterpartReference || undefined,
        counterpartName: attributes.counterpartName || undefined,
      });
    });

    return {
      transactions,
      cursor: (data.meta.paging.after as string) || undefined,
    };
  }

  async startRefresh() {
    const syncAccessToken = await this.obtainAccessToken();

    const response = await fetch("https://api.myponto.com/synchronizations", {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${syncAccessToken}`,
      },
      method: "POST",
      body: JSON.stringify({
        data: {
          type: "synchronization",
          attributes: {
            resourceType: "account",
            resourceId: this.accountId,
            subtype: "accountTransactions",
          },
        },
      }),
    });
    if (response.status !== 400) {
      return (await response.json()).data.id as string;
    }
    return null;
  }

  async checkRefresh(refreshId: string) {
    const syncAccessToken = await this.obtainAccessToken();

    const response = await fetch(
      `https://api.myponto.com/synchronizations/${refreshId}`,
      {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${syncAccessToken}`,
        },
      }
    );
    const data = await response.json();
    return data.data.attributes.status === "success";
  }
}
