// stolen from https://github.com/microsoft/TypeScript/issues/3192#issuecomment-261720275
const enumify = <T extends {[index: string]: U}, U extends string>(x: T): T => x;

export const AddressCategories = enumify({
  erc20: "erc20",
  family: "family",
  friend: "friend",
  private: "private",
  public: "public",
  self: "self",
});
export type AddressCategories = (typeof AddressCategories)[keyof typeof AddressCategories];

export const AddressTags = enumify({
  cdp: "cdp",
  defi: "defi",
  ignore: "ignore",
});
export type AddressTags = (typeof AddressTags)[keyof typeof AddressTags];

export const AssetTypes = enumify({
  DAI: "DAI",
  ETH: "ETH",
  INR: "INR",
  MKR: "MKR",
  SAI: "SAI",
  SNT: "SNT",
  SNX: "SNX",
  USD: "USD",
  WETH: "WETH",
});
export type AssetTypes = (typeof AssetTypes)[keyof typeof AssetTypes];

export const CapitalGainsMethods = enumify({
  FIFO: "FIFO",
  HIFO: "HIFO",
  LIFO: "LIFO",
});
export type CapitalGainsMethods = (typeof CapitalGainsMethods)[keyof typeof CapitalGainsMethods];

export const EventSources = enumify({
  coinbase: "coinbase",
  coingecko: "coingecko",
  ethCall: "ethCall",
  ethLog: "ethLog",
  ethTx: "ethTx",
  personal: "personal",
  sendwyre: "sendwyre",
  tokenCall: "tokenCall",
});
export type EventSources = (typeof EventSources)[keyof typeof EventSources];

export const EventTags = enumify({
  cdp: "cdp",
  defi: "defi",
  ignore: "ignore",
});
export type EventTags = (typeof EventTags)[keyof typeof EventTags];