import { AddressBook, Transaction, Logger, Event, StateJson } from "@finances/types";
import { ContextLogger } from "@finances/utils";

import { emitTransactionEvents, emitTransferEvents } from "./events";
import { getState } from "./state";

export const getValueMachine = (addressBook: AddressBook, logger?: Logger): any => {
  const log = new ContextLogger("ValueMachine", logger);
  const { getName } = addressBook;

  return (oldState: StateJson, transaction: Transaction): [StateJson, Event[]] => {
    const state = getState(addressBook, oldState, logger);
    log.debug(`Applying transaction ${transaction.index} from ${transaction.date}: ${transaction.description}`);
    log.debug(`Applying transfers: ${
      JSON.stringify(transaction.transfers, null, 2)
    } to sub-state ${
      JSON.stringify(state.getRelevantBalances(transaction), null, 2)
    }`);
    const logs = [] as Event[];

    ////////////////////////////////////////
    // VM Core

    const later = [];
    for (const transfer of transaction.transfers) {
      const { assetType, fee, from, quantity, to } = transfer;
      log.debug(`transfering ${quantity} ${assetType} from ${getName(from)} to ${getName(to)}`);
      let feeChunks;
      let chunks;
      try {
        if (fee) {
          feeChunks = state.getChunks(from, assetType, fee, transaction);
          log.debug(`Dropping ${feeChunks.length} chunks to cover fees of ${fee} ${assetType}`);
        }
        chunks = state.getChunks(from, assetType, quantity, transaction);
        chunks.forEach(chunk => state.putChunk(to, chunk));
        logs.push(...emitTransferEvents(addressBook, chunks, transaction, transfer));
      } catch (e) {
        log.debug(e.message);
        if (feeChunks) {
          feeChunks.forEach(chunk => state.putChunk(from, chunk));
        }
        later.push(transfer);
      }
    }

    for (const transfer of later) {
      const { assetType, fee, from, quantity, to } = transfer;
      log.debug(`transfering ${quantity} ${assetType} from ${getName(from)} to ${getName(to)} (attempt 2)`);
      if (fee) {
        const feeChunks = state.getChunks(from, assetType, fee, transaction);
        log.debug(`Dropping ${feeChunks.length} chunks to cover fees of ${fee} ${assetType}`);
      }
      const chunks = state.getChunks(from, assetType, quantity, transaction);
      chunks.forEach(chunk => state.putChunk(to, chunk));
      logs.push(...emitTransferEvents(addressBook, chunks, transaction, transfer));
    }

    ////////////////////////////////////////

    logs.push(...emitTransactionEvents(addressBook, transaction, state));

    state.touch(transaction.date);

    return [state.toJson(), logs];
  };
};
