import { env } from "./env";
import {
  AddressBook,
  AssetChunk,
  AssetTypes,
  DecimalString,
  Event,
  Log,
  State,
} from "./types";
import { add, eq, gt, Logger, round, sub } from "./utils";

const checkpoints = [
  {
    account: "0xada083a3c06ee526f827b43695f2dcff5c8c892b",
    assetType: "ETH",
    balance: "0",
    date: "2017-11-21T07:54:38.000Z",
  },
  {
    account: "0xada083a3c06ee526f827b43695f2dcff5c8c892b",
    assetType: "ETH",
    balance: "6",
    date: "2017-12-05T23:14:55.000Z",
  },
  /*
  {
    account: "0xada083a3c06ee526f827b43695f2dcff5c8c892b",
    assetType: "ETH",
    balance: "5.9820480179",
    date: "2017-12-11T20:28:52.000Z",
  },
  {
    account: "0xada083a3c06ee526f827b43695f2dcff5c8c892b",
    assetType: "ETH",
    balance: "1.472343111572222222",
    date: "2017-12-30T15:14:53.000Z",
  },
  {
    account: "0xada083a3c06ee526f827b43695f2dcff5c8c892b",
    assetType: "ETH",
    balance: "1.102702839572222222",
    date: "2018-02-16T04:08:45.000Z",
  },
  */
];

const assertState = (state: State, event: Event): void => {
  for (const { account, assetType, balance, date } of checkpoints) {
    if (date === event.date) {
      let actual;
      if (!state[account] || !state[account][assetType]) {
        if (!eq(balance, "0")) {
          throw new Error(`Expected accout ${account} to have ${assetType} balance of ${balance} on ${date} but got 0`);
        }
        actual = "0";
      } else {
        actual = state[account][assetType]
          .reduce((sum, chunk) => add([sum, chunk.quantity]), "0");
      }
      if (!eq(actual, balance)) {
        throw new Error(`Expected accout ${account} to have ${assetType} balance of ${balance} on ${date} but got ${actual}`);
      }
    }
  }
};

type SimpleState = any;

export const getValueMachine = (addressBook: AddressBook): any => {
  const log = new Logger("ValueMachine", 5 || env.logLevel);
  const { isSelf, pretty } = addressBook;

  const offTheChain = (assetType: AssetTypes): boolean =>
    ["BTC", "INR", "LTC", "USD"].includes(assetType);

  const noValueError = (account: string, assetType: string): string =>
    `${account} attempted to spend more ${assetType} than they received.`;

  // TODO: what if input.capitalGainsMethod is LIFO or HIFO?
  const getPutChunk = (state: State) =>
    (account: string, assetType: AssetTypes, asset: AssetChunk): void => {
      log.info(`Putting ${asset.quantity} ${assetType} into account ${account}`);
      if (offTheChain(assetType) || !isSelf(account)) {
        log.info(`Skipping off-chain or external asset put`);
        return;
      }
      if (!state[account]) {
        state[account] = {};
      }
      if (!state[account][assetType]) {
        state[account][assetType] = [];
      }
      state[account][assetType].unshift(asset);
    };

  const getGetChunk = (state: State, event: Event) =>
    (account: string, assetType: AssetTypes, quantity: DecimalString): AssetChunk[] => {
      // Everyone has infinite USD in the value machine
      if (assetType === "USD") {
        log.info(`Printing more USD`);
        return [{ dateRecieved: "1970-01-01T00:00:00.000Z", purchasePrice: "1", quantity }];
      }
      log.info(`Getting chunks totaling ${quantity} ${assetType} from ${account}`);
      // We assume nothing about the history of chunks coming to us from the outside
      if (!isSelf(account)) {
        return [{
          dateRecieved: event.date,
          purchasePrice: event.prices[assetType],
          quantity,
        }];
      }
      log.info(`Still getting chunks totaling ${quantity} ${assetType} from ${account}`);
      const putChunk = getPutChunk(state);
      if (!state[account]) {
        state[account] = {};
      }
      if (!state[account][assetType]) {
        state[account][assetType] = [];
        throw new Error(noValueError(account, assetType));
      }
      const output = [];
      let togo = quantity;
      while (gt(togo, "0")) {
        const chunk = state[account][assetType].pop();
        log.debug(`Checking out chunk w ${togo} to go: ${JSON.stringify(chunk, null, 2)}`);
        if (!chunk) {
          throw new Error(noValueError(account, assetType));
        }
        if (gt(chunk.quantity, togo)) {
          const leftovers = { ...chunk, quantity: sub(chunk.quantity, togo) };
          putChunk(account, assetType, leftovers);
          log.debug(`Putting ${leftovers.quantity} back, we're done`);
          output.push({ ...chunk, quantity: togo });
          log.info(`Got ${output.length} chunks totaling ${quantity} ${assetType} from ${account}`);
          return output;
        }
        output.push({ ...chunk, quantity: chunk.quantity });
        togo = sub(togo, chunk.quantity);
        log.debug(`Put ${chunk.quantity} into output, ${togo} to go`);
      }
      return output;
    };

  const getGetBalance = (state: State) =>
    (account: string, assetType: AssetTypes): DecimalString =>
      !state[account]
        ? "0"
        : !state[account][assetType]
        ? "0"
        : !state[account][assetType].length
        ? "0"
        : state[account][assetType].reduce((sum, chunk) => add([sum, chunk.quantity]), "0");

  const getRelevantBalances = (state: State, event: Event): SimpleState => {
    const getBalance = getGetBalance(state);
    const simpleState = {} as SimpleState;
    const accounts = event.transfers.reduce((acc, cur) => {
      isSelf(cur.to) && acc.push(cur.to);
      isSelf(cur.from) && acc.push(cur.from);
      return acc;
    }, []);
    for (const account of accounts) {
      simpleState[account] = {};
      const assetTypes = event.transfers.reduce((acc, cur) => {
        acc.push(cur.assetType);
        return acc;
      }, []);
      for (const assetType of assetTypes) {
        simpleState[account][assetType] = round(getBalance(account, assetType), 8);
      }
    }
    return simpleState;
  };

  return (oldState: State | null, event: Event): [State, Log] => {
    const state = JSON.parse(JSON.stringify(oldState || {})) as State;
    const startingBalances = getRelevantBalances(state, event);
    log.info(`${event.date} Applying "${event.description}" to sub-state ${
      JSON.stringify(startingBalances, null, 2)
    }`);
    const logs = [];
    const [getChunks, putChunk] = [getGetChunk(state, event), getPutChunk(state)];

    assertState(state, event);

    ////////////////////////////////////////
    // VM Core

    const later = [];
    for (const { assetType, fee, from, index, quantity, to } of event.transfers) {
      log.info(`transfering ${quantity} ${assetType} from ${pretty(from)} to ${pretty(to)}`);
      let feeChunks;
      let chunks;
      try {
        if (fee) {
          feeChunks = getChunks(from, assetType, fee);
          log.info(`Dropping ${feeChunks.length} chunks to cover fees of ${fee} ${assetType}`);
        }
        chunks = getChunks(from, assetType, quantity);
        chunks.forEach(chunk => putChunk(to, assetType, chunk));
      } catch (e) {
        log.warn(e.message);
        if (feeChunks) {
          feeChunks.forEach(chunk => putChunk(from, assetType, chunk));
        }
        later.push({ assetType, fee, from, index, quantity, to });
        continue;
      }
    }

    for (const { assetType, fee, from, quantity, to } of later) {
      log.info(`transfering ${quantity} ${assetType} from ${pretty(from)} to ${pretty(to)} (attempt 2)`);
      if (fee) {
        const feeChunks = getChunks(from, assetType, fee);
        log.info(`Dropping ${feeChunks.length} chunks to cover fees of ${fee} ${assetType}`);
      }
      const chunks = getChunks(from, assetType, quantity);
      chunks.forEach(chunk => putChunk(to, assetType, chunk));
    }

    ////////////////////////////////////////

    const endingBalances = getRelevantBalances(state, event);

    // Print & assert on state afterwards
    for (const account of Object.keys(endingBalances)) {
      for (const assetType of Object.keys(endingBalances[account])) {
        const diff = sub(endingBalances[account][assetType], startingBalances[account][assetType]);
        if (!eq(diff, "0")) {
          endingBalances[account][assetType] += ` (${gt(diff, 0) ? "+" : ""}${diff})`;
        }
      }
    }
    log.info(`Final state after applying "${event.description}": ${
      JSON.stringify(endingBalances, null, 2)
    }`);

    return [state, logs];
  };
};
