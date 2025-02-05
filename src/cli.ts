#!/usr/bin/env node

import {
  checkRefreshes,
  countInvoiceOccurrences,
  getDeposits,
  getDestinations,
  getIgnores,
  getMatchers,
  getSources,
  getWithdrawals,
  matchTransactionsWithInvoices,
  pullInvoices,
  pullTransactions,
  markInvoicesAsPaid,
  readConfig,
  readInvoices,
  readMatches,
  readTransactions,
  startRefreshes,
  writeInvoices,
  writeMatches,
  writeTransactions,
} from ".";
import { program } from "commander";

async function doPull() {
  const config = await readConfig("croconfig.json");

  const sources = getSources(config.sources);
  const ignores = getIgnores(config.ignores);

  const destinations = getDestinations(config.destinations);

  console.log(`Starting refreshes for ${sources.length} sources...`);
  const refreshes = await startRefreshes(sources);

  console.log("Waiting for refreshes to complete...");
  do {
    await new Promise((resolve) => setTimeout(resolve, 5000)); // wait 5 seconds
  } while (!(await checkRefreshes(sources, refreshes)));

  console.log(`Pulling transactions from ${sources.length} sources...`);
  const transactions = await pullTransactions(sources, ignores);

  console.log(`Writing ${transactions.length} transactions...`);
  await writeTransactions(transactions, "transactions.json");

  console.log("Pulling invoices...");
  const invoices = await pullInvoices(destinations);

  console.log(`Writing ${invoices.incoming.length} incoming invoices...`);
  await writeInvoices(invoices.incoming, "incoming-invoices.json");

  console.log(`Writing ${invoices.outgoing.length} outgoing invoices...`);
  await writeInvoices(invoices.outgoing, "outgoing-invoices.json");

  console.log("Pull done! 🐊");
}

async function doMatch() {
  const config = await readConfig("croconfig.json");

  console.log("Reading transactions...");
  const transactions = await readTransactions("transactions.json");

  console.log("Reading incoming invoices...");
  const incomingInvoices = await readInvoices("incoming-invoices.json");

  console.log("Reading outgoing invoices...");
  const outgoingInvoices = await readInvoices("outgoing-invoices.json");

  console.log("Matching transactions with incoming invoices...");
  const matchersForIncomingInvoices = getMatchers(
    config.matchers.incomingInvoices
  );
  const matchesForIncomingInvoices = await matchTransactionsWithInvoices(
    getWithdrawals(transactions),
    incomingInvoices,
    matchersForIncomingInvoices
  );
  await writeMatches(
    matchesForIncomingInvoices.filter((match) => match.matchingAmounts),
    "withdrawals-with-proper-matches.json"
  );
  await writeMatches(
    matchesForIncomingInvoices.filter((match) => !match.matchingAmounts),
    "withdrawals-without-proper-matches.json"
  );

  console.log("Matching transactions with outgoing invoices...");
  const matchers = getMatchers(config.matchers.outgoingInvoices);
  const matchesForOutgoingInvoices = await matchTransactionsWithInvoices(
    getDeposits(transactions),
    outgoingInvoices,
    matchers
  );
  await writeMatches(
    matchesForOutgoingInvoices.filter((match) => match.matchingAmounts),
    "deposits-with-proper-matches.json"
  );
  await writeMatches(
    matchesForOutgoingInvoices.filter((match) => !match.matchingAmounts),
    "deposits-without-proper-matches.json"
  );

  console.log("Match done! 🐊");
}

async function doPush() {
  const config = await readConfig("croconfig.json");

  const destinations = getDestinations(config.destinations);

  console.log("Pushing status updates for incoming invoices...");
  const withdrawalsWithProperMatches = await readMatches(
    "withdrawals-with-proper-matches.json"
  );
  for await (const { invoice } of markInvoicesAsPaid(
    withdrawalsWithProperMatches,
    destinations.incoming
  )) {
    console.log(`Marked incoming invoice ${invoice.invoiceNumber} as paid`);
  }

  console.log("Pushing status updates for outgoing invoices...");
  const depositsWithProperMatches = await readMatches(
    "deposits-with-proper-matches.json"
  );
  for await (const { invoice } of markInvoicesAsPaid(
    depositsWithProperMatches,
    destinations.outgoing
  )) {
    console.log(`Marked outgoing invoice ${invoice.invoiceNumber} as paid`);
  }

  console.log("Push done! 🐊");
}

async function doCheck() {
  const withdrawalsWithProperMatches = await readMatches(
    "withdrawals-with-proper-matches.json"
  );
  // check that the same invoice doesn't match multiple withdrawals
  const withdrawalInvoiceCounts = countInvoiceOccurrences(
    withdrawalsWithProperMatches
  );
  const withdrawalInconsistenties = Object.entries(
    withdrawalInvoiceCounts
  ).filter(([invoice, count]) => count > 1);
  for (const [invoice, count] of withdrawalInconsistenties) {
    console.error(`Invoice ${invoice} matches multiple withdrawals`);
  }
  if (withdrawalInconsistenties.length > 0) {
    process.exit(1);
  }

  const depositsWithProperMatches = await readMatches(
    "deposits-with-proper-matches.json"
  );
  // check that the same invoice doesn't match multiple deposits
  const depositInvoiceCounts = countInvoiceOccurrences(
    depositsWithProperMatches
  );
  const depositInconsistenties = Object.entries(depositInvoiceCounts).filter(
    ([invoice, count]) => count > 1
  );
  for (const [invoice, count] of depositInconsistenties) {
    console.error(`Invoice ${invoice} matches multiple deposits`);
  }
  if (depositInconsistenties.length > 0) {
    process.exit(1);
  }

  console.log("All checks passed! 🐊");
}

program
  .name("croconcile")
  .description("Reconcile transactions and invoices with a snappy cron job 🐊");

program
  .command("pull")
  .description("Pull transactions and invoices")
  .action(doPull);

program
  .command("match")
  .description("Match transactions with invoices")
  .action(doMatch);

program
  .command("push")
  .description("Push invoices status updates")
  .action(doPush);

program
  .command("pull-match-push")
  .description("Pull, match, and push invoices status updates")
  .action(async () => {
    await doPull();
    await doMatch();
    await doPush();
  });

program
  .command("check")
  .description("Check for inconsistencies")
  .action(doCheck);

program.parse();
