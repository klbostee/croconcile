import fs from "fs";
import { PontoSource } from "./sources/ponto";
import { PaypalSource } from "./sources/paypal";
import {
  type Config,
  configSchema,
  Invoice,
  invoicesSchema,
  matchesSchema,
  Transaction,
  transactionsSchema,
} from "./schemas";
import { AirtableDestination } from "./destinations/airtable";
import { StructuredReferenceMatcher } from "./matchers/structured-reference";
import { InvoiceNumberMatcher } from "./matchers/invoice-number";
import { UniqueAmountMatcher } from "./matchers/unique-amount";
import { InvoiceNumberWindowMatcher } from "./matchers/invoice-number-window";

export async function readConfig(path: string): Promise<Config> {
  const config = await fs.promises.readFile(path, "utf-8");
  return configSchema.parse(JSON.parse(config));
}

export function getSource(sourceConfig: Config["sources"][string]) {
  switch (sourceConfig.type) {
    case "ponto": {
      return new PontoSource(sourceConfig);
    }
    case "paypal": {
      return new PaypalSource(sourceConfig);
    }
    default: {
      sourceConfig satisfies never; // ensure exhaustive switch
      throw new Error("Unknown source type");
    }
  }
}

export function getSources(sourcesConfig: Config["sources"]) {
  return Object.entries(sourcesConfig).map(([name, sourceConfig]) => ({
    name,
    source: getSource(sourceConfig),
  }));
}

export function getIgnore(
  ignoreConfig:
    | NonNullable<Config["ignores"]>["withdrawals"]
    | NonNullable<Config["ignores"]>["deposits"]
) {
  return { counterpartNames: ignoreConfig?.counterpartNames ?? [] };
}

export function getIgnores(ignoresConfig: Config["ignores"]) {
  return {
    withdrawals: getIgnore(ignoresConfig?.withdrawals),
    deposits: getIgnore(ignoresConfig?.deposits),
  };
}

export async function startRefreshes(sources: ReturnType<typeof getSources>) {
  return Promise.all(
    sources.map(async ({ source }) => {
      const refreshId = await source.startRefresh();
      if (!refreshId) {
        return null;
      }
      return refreshId;
    })
  );
}

export async function checkRefreshes(
  sources: ReturnType<typeof getSources>,
  refreshes: (string | null)[]
) {
  const checks = await Promise.all(
    refreshes.map(async (refreshId, index) => {
      if (!refreshId) {
        return true; // no refresh started, so check passes
      }
      const { source } = sources[index];
      return source.checkRefresh(refreshId);
    })
  );
  return checks.every(Boolean);
}

export async function pullTransactions(
  sources: ReturnType<typeof getSources>,
  ignores: ReturnType<typeof getIgnores>
) {
  const transactions = (
    await Promise.all(
      sources.map(async ({ source }) => {
        let { transactions, cursor } = await source.fetchTransactions();
        while (cursor) {
          const { transactions: moreTransactions, cursor: newCursor } =
            await source.fetchTransactions(cursor);
          transactions.push(...moreTransactions);
          cursor = newCursor;
        }
        return transactions;
      })
    )
  ).flat();
  return transactions.filter((transaction) => {
    if (!transaction.counterpartName) {
      return true;
    }
    if (transaction.amount < 0) {
      return !ignores.withdrawals.counterpartNames.includes(
        transaction.counterpartName
      );
    } else {
      return !ignores.deposits.counterpartNames.includes(
        transaction.counterpartName
      );
    }
  });
}

export async function writeTransactions(
  transactions: Transaction[],
  path: string
) {
  // sorting is in place, but that should be fine
  transactions.sort((a, b) => {
    const isoTimestampComparison = a.isoTimestamp.localeCompare(b.isoTimestamp);
    if (isoTimestampComparison !== 0) {
      return -isoTimestampComparison; // reverse chronological order
    }
    const sourceTypeComparison = a.sourceType.localeCompare(b.sourceType);
    if (sourceTypeComparison !== 0) {
      return sourceTypeComparison;
    }
    return a.foreignId.localeCompare(b.foreignId);
  });
  await fs.promises.writeFile(path, JSON.stringify(transactions, null, 2));
}

export async function readTransactions(path: string) {
  const transactions = await fs.promises.readFile(path, "utf-8");
  return transactionsSchema.parse(JSON.parse(transactions));
}

export function getDestination(
  destinationConfig:
    | Config["destinations"]["incomingInvoices"]
    | Config["destinations"]["outgoingInvoices"]
) {
  switch (destinationConfig.type) {
    case "airtable": {
      return new AirtableDestination(destinationConfig);
    }
    default: {
      // destinationConfig satisfies never; // ensure exhaustive switch
      throw new Error("Unknown destination type");
    }
  }
}

export function getDestinations(destinationsConfig: Config["destinations"]) {
  return {
    incoming: getDestination(destinationsConfig.incomingInvoices),
    outgoing: getDestination(destinationsConfig.outgoingInvoices),
  };
}

export async function pullInvoices(
  destinations: ReturnType<typeof getDestinations>
): Promise<{ incoming: Invoice[]; outgoing: Invoice[] }> {
  return Object.fromEntries(
    await Promise.all(
      Object.entries(destinations).map(async ([direction, destination]) => {
        let { invoices, cursor } = await destination.fetchInvoices();
        while (cursor) {
          const { invoices: moreInvoices, cursor: newCursor } =
            await destination.fetchInvoices(cursor);
          invoices.push(...moreInvoices);
          cursor = newCursor;
        }
        return [direction, invoices];
      })
    )
  );
}

export async function writeInvoices(invoices: Invoice[], path: string) {
  // sorting is in place, but that should be fine
  invoices.sort((a, b) => {
    const invoiceDateComparison = a.invoiceDate.localeCompare(b.invoiceDate);
    if (invoiceDateComparison !== 0) {
      return -invoiceDateComparison; // reverse chronological order
    }
    return a.foreignId.localeCompare(b.foreignId);
  });
  await fs.promises.writeFile(path, JSON.stringify(invoices, null, 2));
}

export async function readInvoices(path: string) {
  const invoices = await fs.promises.readFile(path, "utf-8");
  return invoicesSchema.parse(JSON.parse(invoices));
}

export function getMatcher(
  matcherConfig:
    | Config["matchers"]["incomingInvoices"][number]
    | Config["matchers"]["outgoingInvoices"][number]
) {
  switch (matcherConfig.type) {
    case "structuredReference": {
      return new StructuredReferenceMatcher();
    }
    case "invoiceNumber": {
      return new InvoiceNumberMatcher(matcherConfig);
    }
    case "invoiceNumberWindow": {
      return new InvoiceNumberWindowMatcher(matcherConfig);
    }
    case "uniqueAmount": {
      return new UniqueAmountMatcher();
    }
    default: {
      matcherConfig satisfies never; // ensure exhaustive switch
      throw new Error("Unknown matcher type");
    }
  }
}

export function getMatchers(
  matchersConfig:
    | Config["matchers"]["incomingInvoices"]
    | Config["matchers"]["outgoingInvoices"]
) {
  return matchersConfig.map((matcherConfig) => {
    return {
      matcherType: matcherConfig.type,
      matcher: getMatcher(matcherConfig),
    };
  });
}

export function getWithdrawals(transactions: Transaction[]) {
  return transactions.filter((transaction) => transaction.amount < 0);
}

export function getDeposits(transactions: Transaction[]) {
  return transactions.filter((transaction) => transaction.amount > 0);
}

export async function matchTransactionsWithInvoices(
  transactions: Transaction[],
  outgoingInvoices: Invoice[],
  matchers: ReturnType<typeof getMatchers>
) {
  return transactions.map((transaction) => {
    // the first matcher that returns invoices summing up to the transaction amount wins
    for (const { matcherType, matcher } of matchers) {
      const invoices = matcher.matchTransactionWithInvoices(
        transaction,
        outgoingInvoices
      );
      // check if the invoices sum up to the transaction amount
      const total = invoices.reduce((acc, invoice) => acc + invoice.amount, 0);
      if (Math.abs(Math.abs(transaction.amount) - total) < 1) {
        return {
          transaction,
          invoices,
          matcherType,
          matchingAmounts: true,
        };
      }
    }
    // when no matcher returns invoices that sum up to the transaction amount,
    // try again and let the first matcher that returns any invoices win
    for (const { matcherType, matcher } of matchers) {
      const invoices = matcher.matchTransactionWithInvoices(
        transaction,
        outgoingInvoices
      );
      if (invoices.length > 0) {
        return {
          transaction,
          invoices,
          matcherType,
          matchingAmounts: false,
        };
      }
    }
    // when no matcher returns any invoices, return an empty invoices array
    return {
      transaction,
      invoices: [],
      matcherType: null,
      matchingAmounts: false,
    };
  });
}

export async function writeMatches(
  matches: Awaited<ReturnType<typeof matchTransactionsWithInvoices>>,
  path: string
) {
  await fs.promises.writeFile(path, JSON.stringify(matches, null, 2));
}

export async function readMatches(path: string) {
  const matches = await fs.promises.readFile(path, "utf-8");
  return matchesSchema.parse(JSON.parse(matches));
}

export async function* markInvoicesAsPaid(
  matches: Awaited<ReturnType<typeof readMatches>>,
  destination: ReturnType<typeof getDestination>
) {
  for (const match of matches) {
    if (match.invoices.length === 0) {
      continue;
    }
    const unpaidInvoices = match.invoices.filter((invoice) => !invoice.isPaid);
    for (const invoice of unpaidInvoices) {
      if (
        await destination.markInvoiceAsPaid(
          invoice.foreignId,
          match.transaction.isoTimestamp
        )
      ) {
        yield { match, invoice };
      }
    }
  }
}

export function countInvoiceOccurrences(
  matches: Awaited<ReturnType<typeof readMatches>>
) {
  return matches.reduce((acc, match) => {
    match.invoices.forEach((invoice) => {
      if (acc[invoice.invoiceNumber]) {
        acc[invoice.invoiceNumber] += 1;
      } else {
        acc[invoice.invoiceNumber] = 1;
      }
    });
    return acc;
  }, {} as Record<string, number>);
}
