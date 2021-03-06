import fs from "fs";

import {
  getAddressBook,
  getChainData,
  getState,
  getValueMachine,
} from "@finances/core";
import { ExpenseEvent, EventTypes, StoreKeys } from "@finances/types";
import { ContextLogger, LevelLogger, math } from "@finances/utils";

import { store } from "./store";
import { env, setEnv } from "./env";
import * as filers from "./filers";
import { mappings, Forms } from "./mappings";
import { getTransactions } from "./transactions";
import { InputData } from "./types";
import { emptyForm, mergeForms, translate } from "./utils";

// Order of this list is important, it should follow the dependency graph.
// ie: first no dependents, last no dependencies
const supportedForms = [
  "f2210",
  "f1040",
  "f2555",
  "f1040s1",
  "f1040s2",
  "f1040s3",
  "f1040sse",
  "f1040sc",
  "f1040sd",
  "f8949",
  "f8889",
];

const logAndExit = (msg: any): void => {
  console.error(msg);
  process.exit(1);
};
process.on("uncaughtException", logAndExit);
process.on("unhandledRejection", logAndExit);
process.on("SIGINT", logAndExit);

(async (): Promise<void> => {
  const inputFile = `${process.cwd()}/${process.argv[2]}`;

  const input = JSON.parse(fs.readFileSync(inputFile, { encoding: "utf8" })) as InputData;
  const username = input.env.username;
  const logger = new LevelLogger(input.env.logLevel);
  const log = new ContextLogger("Taxes", logger);
  log.debug(`Generating tax return data for ${username} (log level: ${input.env.logLevel})`);

  const outputFolder = `${process.cwd()}/build/${username}/data`;

  let output = {} as Forms;

  setEnv({ ...input.env, outputFolder });
  log.debug(`Starting app in env: ${JSON.stringify(env)}`);

  const formsToFile = supportedForms.filter(form => input.forms.includes(form));

  ////////////////////////////////////////
  // Step 1: Fetch & parse financial history

  const addressBook = getAddressBook(input.addressBook, logger);

  const chainData = await getChainData({ store, logger, etherscanKey: input.env.etherscanKey });

  await chainData.syncTokenData(addressBook.addresses.filter(addressBook.isToken));
  await chainData.syncAddressHistory(addressBook.addresses.filter(addressBook.isSelf));

  const transactions = await getTransactions(
    addressBook,
    chainData,
    store,
    input.transactions,
    logger,
  );

  const valueMachine = getValueMachine(addressBook, logger);

  let state = store.load(StoreKeys.State);
  let vmEvents = store.load(StoreKeys.Events);
  let start = Date.now();
  for (const transaction of transactions.filter(
    transaction => new Date(transaction.date).getTime() > new Date(state.lastUpdated).getTime(),
  )) {
    const [newState, newEvents] = valueMachine(state, transaction);
    vmEvents = vmEvents.concat(...newEvents);
    state = newState;

    const chunk = 100;
    if (transaction.index % chunk === 0) {
      const diff = (Date.now() - start).toString();
        log.info(`Processed transactions ${transaction.index - chunk}-${transaction.index} in ${diff} ms`);
      start = Date.now();
    }

  }
  store.save(StoreKeys.State, state);
  store.save(StoreKeys.Events, vmEvents);

  const finalState = getState(addressBook, state, logger);

  log.debug(`Final state: ${JSON.stringify(finalState.getAllBalances(), null, 2)}`);
  log.info(`\nNet Worth: ${JSON.stringify(finalState.getNetWorth(), null, 2)}`);

  log.info(`Done compiling financial events.\n`);

  ////////////////////////////////////////
  // Step 2: Start out w empty forms containing raw user supplied data

  for (const form of formsToFile) {
    if (!mappings[form]) {
      throw new Error(`Form ${form} not supported: No mappings available`);
    }
    // TODO: simplify multi-page detection
    if (input.formData[form] && typeof input.formData[form].length === "number") {
      if (!output[form]) {
        output[form] = [];
      }
      input.formData[form].forEach(page => {
        log.debug(`Adding info for page of form ${form}: ${JSON.stringify(page)}`);
        output[form].push(mergeForms(emptyForm(mappings[form]), page));
      });
    } else {
      output[form] = mergeForms(emptyForm(mappings[form]), input.formData[form]);
    }
  }

  ////////////////////////////////////////
  // Step 3: Fill out a few simple fields from user input

  if (input.dividends && input.dividends.length > 0) {
    const total = { qualified: "0", ordinary: "0" };
    input.dividends.forEach(dividend => {
      if (dividend.assetType !== "USD") {
        return;
      }
      const isQualified = dividend.tags.includes("qualified");
      log.info(`Adding ${isQualified ? "qualified " : ""}dividend of ${dividend.quantity} ${dividend.assetType} from ${dividend.source}`);
      total.ordinary = math.add(total.ordinary, dividend.quantity);
      if (isQualified) {
        total.qualified = math.add(total.qualified, dividend.quantity);
      }
    });
    output.f1040.L3a = math.round(total.qualified);
    output.f1040.L3b = math.round(total.ordinary);
  }

  if (input.expenses && input.expenses.length > 0) {
    input.expenses.forEach(expense => {
      vmEvents.push({
        assetType: "USD",
        assetPrice: "1",
        to: "merchant",
        taxTags: [],
        type: EventTypes.Expense,
        ...expense,
      } as ExpenseEvent);
      vmEvents.sort((a, b): number => new Date(a.date).getTime() - new Date(b.date).getTime());
    });
  }

  ////////////////////////////////////////
  // Step 4: calculate data for the rest of the forms from financial data

  if (env.mode !== "test") {
    for (const form of formsToFile.reverse()) {
      if (!filers[form]) {
        log.warn(`No filer is available for form ${form}. Using unmodified user input.`);
        continue;
      }
      output = filers[form](
        vmEvents.filter(vmEvent => vmEvent.date.startsWith(env.taxYear)),
        output,
      );
    }
  }

  ////////////////////////////////////////
  // Step 5: Save form data to disk

  for (const [name, data] of Object.entries(output)) {
    if (!(data as any).length || (data as any).length === 1) {
      const filename = `${outputFolder}/${name}.json`;
      log.info(`Saving ${name} data to ${filename}`);
      const outputData =
        JSON.stringify(translate(data, mappings[name]), null, 2);
      fs.writeFileSync(filename, outputData);
    } else {
      let i = 1;
      for (const page of (data as any)) {
        const pageName = `f8949_${i}`;
        const fileName = `${outputFolder}/${pageName}.json`;
        log.info(`Saving page ${i} of ${name} data to ${fileName}`);
        const outputData = JSON.stringify(translate(page, mappings[name]), null, 2);
        fs.writeFileSync(fileName, outputData);
        i += 1;
      }
    }
  }
})();
