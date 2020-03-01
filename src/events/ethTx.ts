import { AddressZero } from "ethers/constants";
import { Interface, hexlify, formatEther, keccak256, EventDescription, RLP } from "ethers/utils";
import { abi as tokenAbi } from "@openzeppelin/contracts/build/contracts/ERC20.json";

import { env } from "../env";
import { Event, TransactionData } from "../types";
import { eq, Logger } from "../utils";
import { saiAbi, wethAbi } from "../abi";
import { mergeFactory } from "./utils";

const getEvents = (abi: any): EventDescription[] => Object.values((new Interface(abi)).events);
const tokenEvents =
  Object.values(getEvents(tokenAbi).concat(getEvents(wethAbi)).concat(getEvents(saiAbi)));

export const castEthTx = (addressBook): any =>
  (tx: TransactionData): Event | null => {
    const log = new Logger(`EthTx ${tx.hash.substring(0, 10)}`, env.logLevel);
    const { getName, isCategory } = addressBook;

    if (!tx.logs) {
      throw new Error(`Missing logs for tx ${tx.hash}, did fetchChainData get interrupted?`);
    }

    if (tx.to === null) {
      // derived from: https://ethereum.stackexchange.com/a/46960
      tx.to = "0x" + keccak256(RLP.encode([tx.from, hexlify(tx.nonce)])).substring(26);
      log.info(`new contract deployed to ${tx.to}`);
    }

    const event = {
      date: tx.timestamp,
      hash: tx.hash,
      prices: {},
      sources: new Set(["ethTx"]),
      tags: new Set(),
      transfers: [{
        assetType: "ETH",
        from: tx.from,
        quantity: tx.value,
        to: tx.to,
      }],
    } as Event;

    log.debug(`transfer of ${tx.value} ETH from ${tx.from} to ${tx.to}}`);

    for (const txLog of tx.logs) {
      if (isCategory(txLog.address, "erc20")) {

        const assetType = getName(txLog.address).toUpperCase();

        const eventI = tokenEvents.find(e => e.topic === txLog.topics[0]);
        if (!eventI) {
          log.debug(`Unable to identify ${assetType} event w topic: ${txLog.topics[0]}`);
          continue;
        }

        const data = eventI.decode(txLog.data, txLog.topics);
        if (!data) {
          log.debug(`Unable to decode ${assetType} ${eventI.name} event data`);
          continue;
        }
        const quantity = formatEther(data.value || data.wad || "0");

        if (eventI.name === "Transfer") {
          event.transfers.push({
            assetType,
            from: data.from,
            quantity,
            to: data.to,
          });
          log.debug(`${quantity} ${assetType} was transfered to ${data.to}`);

        } else if (assetType === "WETH" && eventI.name === "Deposit") {
          event.transfers.push({
            assetType,
            from: txLog.address,
            quantity: quantity,
            to: data.dst,
          });
          log.debug(`Deposit by ${data.dst} minted ${quantity} ${assetType}`);

        } else if (assetType === "WETH" && eventI.name === "Withdrawal") {
          event.transfers.push({
            assetType,
            from: data.src,
            quantity: quantity,
            to: txLog.address,
          });
          log.debug(`Withdraw by ${data.dst} burnt ${quantity} ${assetType}`);

        } else if (assetType === "SAI" && eventI.name === "Mint") {
          event.transfers.push({
            assetType,
            from: AddressZero,
            quantity: quantity,
            to: data.guy,
          });
          log.debug(`Minted ${quantity} ${assetType}`);

        } else if (assetType === "SAI" && eventI.name === "Burn") {
          event.transfers.push({
            assetType,
            from: data.guy,
            quantity: quantity,
            to: AddressZero,
          });
          log.debug(`Burnt ${quantity} ${assetType}`);

        } else if (eventI.name === "Approval") {
          log.debug(`Skipping Approval event`);

        } else if (eventI) {
          log.debug(`Unknown ${assetType} event: ${JSON.stringify(eventI)}`);
        }
      }
    }
    event.sources.add("ethLogs");

    // Filter out any zero-value transfers
    event.transfers = event.transfers.filter(transfer => !eq(transfer.quantity, "0"));

    if (event.transfers.length === 0) {
      return null;
    } else if (event.transfers.length === 1) {
      const { quantity, assetType, to } = event.transfers[0];
      event.description = `ethTx sent ${quantity} ${assetType} to ${addressBook.getName(to)}`;
    } else {
      event.description = `ethTx made ${event.transfers.length} transfers`;
    }

    event.description !== "null"
      ? log.info(event.description)
      : log.debug(event.description);

    return event;
  };

export const mergeEthTx = mergeFactory({
  allowableTimeDiff: 0,
  log: new Logger("MergeEthTx", env.logLevel),
  mergeEvents: (): void => {
    throw new Error(`idk how to merge txEvents`);
  },
  shouldMerge: (event: Event, txEvent: Event): boolean =>
    event.hash === txEvent.hash,
});
