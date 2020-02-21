import { Interface, formatEther } from "ethers/utils";
import tokenAbi from "human-standard-token-abi";

import { InputData, Event, TransactionData, TransactionLog } from "../types";
import { Logger, add, addAssets, eq, gt, lt, mul, round, sub } from "../utils";

const lowerCaseKeys = (obj: object): object => {
  const output = {};
  Object.entries(obj).forEach(entry => {
    output[entry[0].toLowerCase()] = entry[1];
  });
  return output;
};

export const parseEthTxFactory = (input: InputData) => {
  const log = new Logger("ParseEthTx", input.logLevel);
  const addressBook = lowerCaseKeys(input.addressBook) as { [key: string]: string; };
  const tokens = lowerCaseKeys(input.supportedERC20s) as { [key: string]: string; };
  const tokenI = new Interface(tokenAbi);

  const isSelf = (address: string | null) =>
    address && input.ethAddresses.map(a => a.toLowerCase()).includes(address.toLowerCase());

  const pretty = (address: string): string =>
    addressBook[address.toLowerCase()] || (isSelf(address) ? "self" : address.substring(0, 10));

  return (tx: TransactionData): Event | null => {
    if (!tx.logs) {
      throw new Error(`Missing logs for tx ${tx.hash}, did fetchChainData get interrupted?`);
    }

    if (tx.to === null) {
      log.debug(`Skipping contract creation tx`);
      return null;
    }

    const event = {
      assetsIn: [],
      assetsOut: [],
      date: tx.timestamp,
      from: pretty(tx.from),
      hash: tx.hash,
      source: "ethereum",
      to: pretty(tx.to),
    } as Event;

    
    if (tx.logs.length === 0) {
      if (isSelf(tx.to) && isSelf(tx.from)) {
        log.debug(`Skipping simple tx that only contains self-to-self transfers`);
        return null;
      }
      if (isSelf(tx.to) && !isSelf(tx.from)) {
        log.debug(`Skipping simple tx that only contains self-to-self transfers`);
        return null;
      }
      if (eq(tx.value, "0")) {
        log.debug(`Skipping simple tx with zero-value`);
        return null;
      }
    }

    // ETH in
    if (tx.value !== "0.0" && isSelf(tx.to) && !isSelf(tx.from)) {
      log.debug(`${pretty(tx.hash)} Got income tx of ${tx.value} ETH from ${pretty(tx.from)}`);
      event.assetsIn.push({ amount: tx.value, type: "ETH" });
      event.category = "income";
    }

    // ETH out
    if (tx.value !== "0.0" && !isSelf(tx.to) && isSelf(tx.from)) {
      log.debug(`${pretty(tx.hash)} Got expense tx of ${tx.value} ETH to ${pretty(tx.to)}`);
      event.assetsOut.push({ amount: tx.value, type: "ETH" });
      event.category = "expense";
    }

    for (const txLog of tx.logs) {
      if (Object.keys(tokens).includes(txLog.address.toLowerCase())) {
        const assetType = tokens[txLog.address.toLowerCase()].toUpperCase();
        let eventI = Object.values(tokenI.events).find(e => e.topic === txLog.topics[0]);
        if (eventI && eventI.name === "Transfer") {
          const data = eventI.decode(txLog.data, txLog.topics);
          const amount = formatEther(data._value);
          if (amount === "0.0") {
            log.debug(`${pretty(tx.hash)} Skipping zero-value ${assetType} transfer`);
            continue;
          }
          if (isSelf(data._to) && isSelf(data._from)) {
            log.debug(`${pretty(tx.hash)} Skipping self-to-self ${assetType} transfer`);
          } else if (!isSelf(data._to) && isSelf(data._from)) {
            event.assetsOut.push({ amount, type: assetType });
            event.to = pretty(data._to);
            log.debug(`${pretty(tx.hash)} Got expense of ${amount} ${assetType} to ${event.to}`);
          } else if (isSelf(data._to) && !isSelf(data._from)) {
            event.assetsIn.push({ amount, type: assetType });
            event.from = pretty(data._from);
            log.debug(`${pretty(tx.hash)} Got income of ${amount} ${assetType} from ${event.from}`);
          } else {
            log.debug(`${pretty(tx.hash)} Skipping external-to-external ${assetType} transfer`);
          }
        } else if (eventI && eventI.name === "Approval") {
          continue; // Known & not needed, silently skip
        } else {
          log.debug(`${pretty(tx.hash)} Unknown event topic for ${assetType}: ${txLog.topics[0]}`);
        }
      }
    }

    const income = addAssets(event.assetsIn).map(a => `${round(a.amount)} ${a.type}`).join(", ");
    const expense = addAssets(event.assetsOut).map(a => `${round(a.amount)} ${a.type}`).join(", ");

    if (event.assetsIn.length === 0 && event.assetsOut.length === 0) {
      return null;
    } else if (event.assetsIn.length !== 0 && event.assetsOut.length === 0) {
      event.description = `income of ${income} from ${event.from}`;
      event.category = "income";
    } else if (event.assetsIn.length === 0 && event.assetsOut.length !== 0) {
      event.description = `expense of ${expense} to ${event.to}`;
      event.category = "expense";
    } else if (event.assetsIn.length !== 0 && event.assetsOut.length !== 0) {
      event.description = `swap of ${expense} for ${income}`;
      event.category = "swap";
    }

    log.debug(`${pretty(tx.hash)} ${event.description}`);
    return event;
  };
};
