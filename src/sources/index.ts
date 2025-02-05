import { Transaction } from "../schemas";

export abstract class Source {
  abstract fetchTransactions(
    cursor?: string
  ): Promise<{ transactions: Transaction[]; cursor?: string }>;

  async startRefresh(): Promise<string | null> {
    return null;
  }

  async checkRefresh(refreshId: string): Promise<boolean> {
    return false;
  }
}
