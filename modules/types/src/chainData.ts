import { Address, DateString, DecimalString, HexString, TimestampString } from "./strings";

export type EthCall = {
  block: number;
  contractAddress: Address; // AddressZero if ETH
  from: Address;
  hash: HexString;
  timestamp: TimestampString;
  to: Address;
  value: DecimalString;
};

export type EthTransactionLog = {
  address: Address;
  data: HexString;
  index: number;
  topics: Array<HexString>;
}

export type EthTransaction = {
  block: number;
  data: HexString;
  from: Address;
  gasLimit: HexString;
  gasPrice: HexString;
  gasUsed?: HexString;
  hash: HexString;
  index?: number;
  logs?: EthTransactionLog[];
  nonce: number;
  status?: number | undefined;
  timestamp: TimestampString;
  to: Address | null;
  value: DecimalString;
};

export type TokenData = {
  decimals: number;
  name: string;
  symbol: string;
}

export type ChainDataJson = {
  addresses: {
    [address: string]: {
      history: HexString[]; /* List of txns involving this address */
      lastUpdated: DateString;
    };
  };
  calls: EthCall[]; // Note: we can have multiple calls per txHash
  tokens: { [address: string]: TokenData };
  transactions: EthTransaction[];
};

export interface ChainData {
  getAddressHistory: (...addresses: Address[]) => ChainData;
  getTokenData: (token: Address) => TokenData;
  getEthTransaction: (hash: HexString) => EthTransaction;
  getEthTransactions: (testFn: (tx: EthTransaction) => boolean) => EthTransaction[];
  getEthCall: (hash: HexString) => EthCall;
  getEthCalls: (testFn: (call: EthCall) => boolean) => EthCall[];
  json: ChainDataJson;
  merge: (newJson: ChainDataJson) => void;
  syncAddressHistory: (addresses: Address[], key?: string) => Promise<void>;
  syncTokenData: (tokens: Address[], key?: string) => Promise<void>;
}

export const emptyChainData = {
  addresses: {},
  calls: [],
  tokens: {},
  transactions: [],
} as ChainDataJson;
