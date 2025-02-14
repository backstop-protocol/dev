## API Report File for "@liquity/lib-ethers"

> Do not edit this file. It is a report generated by [API Extractor](https://api-extractor.com/).

```ts

import { BigNumberish } from '@ethersproject/bignumber';
import { BlockTag } from '@ethersproject/abstract-provider';
import { CollateralGainTransferDetails } from '@liquity/lib-base';
import { Decimal } from '@liquity/lib-base';
import { Decimalish } from '@liquity/lib-base';
import { ErrorCode } from '@ethersproject/logger';
import { FailedReceipt } from '@liquity/lib-base';
import { Fees } from '@liquity/lib-base';
import { FrontendStatus } from '@liquity/lib-base';
import { LiquidationDetails } from '@liquity/lib-base';
import { LiquityReceipt } from '@liquity/lib-base';
import { LiquityStore } from '@liquity/lib-base';
import { LiquityStoreState } from '@liquity/lib-base';
import { LQTYStake } from '@liquity/lib-base';
import { MinedReceipt } from '@liquity/lib-base';
import { ObservableLiquity } from '@liquity/lib-base';
import { PopulatableLiquity } from '@liquity/lib-base';
import { PopulatedLiquityTransaction } from '@liquity/lib-base';
import { PopulatedRedemption } from '@liquity/lib-base';
import { PopulatedTransaction } from '@ethersproject/contracts';
import { Provider } from '@ethersproject/abstract-provider';
import { ReadableLiquity } from '@liquity/lib-base';
import { RedemptionDetails } from '@liquity/lib-base';
import { SendableLiquity } from '@liquity/lib-base';
import { SentLiquityTransaction } from '@liquity/lib-base';
import { Signer } from '@ethersproject/abstract-signer';
import { StabilityDeposit } from '@liquity/lib-base';
import { StabilityDepositChangeDetails } from '@liquity/lib-base';
import { StabilityPoolGainsWithdrawalDetails } from '@liquity/lib-base';
import { TransactableLiquity } from '@liquity/lib-base';
import { TransactionFailedError } from '@liquity/lib-base';
import { TransactionReceipt } from '@ethersproject/abstract-provider';
import { TransactionResponse } from '@ethersproject/abstract-provider';
import { Trove } from '@liquity/lib-base';
import { TroveAdjustmentDetails } from '@liquity/lib-base';
import { TroveAdjustmentParams } from '@liquity/lib-base';
import { TroveClosureDetails } from '@liquity/lib-base';
import { TroveCreationDetails } from '@liquity/lib-base';
import { TroveCreationParams } from '@liquity/lib-base';
import { TroveListingParams } from '@liquity/lib-base';
import { TroveWithPendingRedistribution } from '@liquity/lib-base';
import { UserTrove } from '@liquity/lib-base';

// @public
export class BlockPolledLiquityStore extends LiquityStore<BlockPolledLiquityStoreExtraState> {
    constructor(readable: ReadableEthersLiquity);
    // (undocumented)
    readonly connection: EthersLiquityConnection;
    // @internal @override (undocumented)
    protected _doStart(): () => void;
    // @internal @override (undocumented)
    protected _reduceExtra(oldState: BlockPolledLiquityStoreExtraState, stateUpdate: Partial<BlockPolledLiquityStoreExtraState>): BlockPolledLiquityStoreExtraState;
}

// @public
export interface BlockPolledLiquityStoreExtraState {
    // (undocumented)
    bammAllowance: boolean;
    blockTag?: number;
    blockTimestamp: number;
    // @internal (undocumented)
    _feesFactory: (blockTimestamp: number, recoveryMode: boolean) => Fees;
}

// @public
export type BlockPolledLiquityStoreState = LiquityStoreState<BlockPolledLiquityStoreExtraState>;

// @public
export interface BorrowingOperationOptionalParams {
    borrowingFeeDecayToleranceMinutes?: number;
    maxBorrowingRate?: Decimalish;
}

// @internal (undocumented)
export function _connectByChainId<T>(provider: EthersProvider, signer: EthersSigner | undefined, chainId: number, optionalParams: EthersLiquityConnectionOptionalParams & {
    useStore: T;
}): EthersLiquityConnection & {
    useStore: T;
};

// @internal (undocumented)
export function _connectByChainId(provider: EthersProvider, signer: EthersSigner | undefined, chainId: number, optionalParams?: EthersLiquityConnectionOptionalParams): EthersLiquityConnection;

// @public
export interface EthersCallOverrides {
    // (undocumented)
    blockTag?: BlockTag;
}

// @public
export class EthersLiquity implements ReadableEthersLiquity, TransactableLiquity {
    // @internal
    constructor(readable: ReadableEthersLiquity);
    // (undocumented)
    adjustTrove(params: TroveAdjustmentParams<Decimalish>, maxBorrowingRateOrOptionalParams?: Decimalish | BorrowingOperationOptionalParams, overrides?: EthersTransactionOverrides): Promise<TroveAdjustmentDetails>;
    // (undocumented)
    approveUniTokens(allowance?: Decimalish, overrides?: EthersTransactionOverrides): Promise<void>;
    // (undocumented)
    borrowLUSD(amount: Decimalish, maxBorrowingRate?: Decimalish, overrides?: EthersTransactionOverrides): Promise<TroveAdjustmentDetails>;
    // (undocumented)
    claimCollateralSurplus(overrides?: EthersTransactionOverrides): Promise<void>;
    // (undocumented)
    closeTrove(overrides?: EthersTransactionOverrides): Promise<TroveClosureDetails>;
    // @internal (undocumented)
    static connect(signerOrProvider: EthersSigner | EthersProvider, optionalParams: EthersLiquityConnectionOptionalParams & {
        useStore: "blockPolled";
    }): Promise<EthersLiquityWithStore<BlockPolledLiquityStore>>;
    static connect(signerOrProvider: EthersSigner | EthersProvider, optionalParams?: EthersLiquityConnectionOptionalParams): Promise<EthersLiquity>;
    readonly connection: EthersLiquityConnection;
    // (undocumented)
    depositCollateral(amount: Decimalish, overrides?: EthersTransactionOverrides): Promise<TroveAdjustmentDetails>;
    // (undocumented)
    depositLUSDInStabilityPool(amount: Decimalish, frontendTag?: string, overrides?: EthersTransactionOverrides): Promise<StabilityDepositChangeDetails>;
    // (undocumented)
    exitLiquidityMining(overrides?: EthersTransactionOverrides): Promise<void>;
    // @internal (undocumented)
    static _from(connection: EthersLiquityConnection & {
        useStore: "blockPolled";
    }): EthersLiquityWithStore<BlockPolledLiquityStore>;
    // @internal (undocumented)
    static _from(connection: EthersLiquityConnection): EthersLiquity;
    // @internal (undocumented)
    _getActivePool(overrides?: EthersCallOverrides): Promise<Trove>;
    // (undocumented)
    getBammAllowance(overrides?: EthersCallOverrides): Promise<boolean>;
    // @internal (undocumented)
    _getBlockTimestamp(blockTag?: BlockTag): Promise<number>;
    // (undocumented)
    getCollateralSurplusBalance(address?: string, overrides?: EthersCallOverrides): Promise<Decimal>;
    // @internal (undocumented)
    _getDefaultPool(overrides?: EthersCallOverrides): Promise<Trove>;
    // (undocumented)
    getFees(overrides?: EthersCallOverrides): Promise<Fees>;
    // @internal (undocumented)
    _getFeesFactory(overrides?: EthersCallOverrides): Promise<(blockTimestamp: number, recoveryMode: boolean) => Fees>;
    // (undocumented)
    getFrontendStatus(address?: string, overrides?: EthersCallOverrides): Promise<FrontendStatus>;
    // (undocumented)
    getLiquidityMiningLQTYReward(address?: string, overrides?: EthersCallOverrides): Promise<Decimal>;
    // (undocumented)
    getLiquidityMiningStake(address?: string, overrides?: EthersCallOverrides): Promise<Decimal>;
    // (undocumented)
    getLQTYBalance(address?: string, overrides?: EthersCallOverrides): Promise<Decimal>;
    // (undocumented)
    getLQTYStake(address?: string, overrides?: EthersCallOverrides): Promise<LQTYStake>;
    // (undocumented)
    getLUSDBalance(address?: string, overrides?: EthersCallOverrides): Promise<Decimal>;
    // (undocumented)
    getLUSDInStabilityPool(overrides?: EthersCallOverrides): Promise<Decimal>;
    // (undocumented)
    getNumberOfTroves(overrides?: EthersCallOverrides): Promise<number>;
    // (undocumented)
    getPrice(overrides?: EthersCallOverrides): Promise<Decimal>;
    // (undocumented)
    getRemainingLiquidityMiningLQTYReward(overrides?: EthersCallOverrides): Promise<Decimal>;
    // @internal (undocumented)
    _getRemainingLiquidityMiningLQTYRewardCalculator(overrides?: EthersCallOverrides): Promise<(blockTimestamp: number) => Decimal>;
    // (undocumented)
    getRemainingStabilityPoolLQTYReward(overrides?: EthersCallOverrides): Promise<Decimal>;
    // (undocumented)
    getStabilityDeposit(address?: string, overrides?: EthersCallOverrides): Promise<StabilityDeposit>;
    // (undocumented)
    getTotal(overrides?: EthersCallOverrides): Promise<Trove>;
    // (undocumented)
    getTotalRedistributed(overrides?: EthersCallOverrides): Promise<Trove>;
    // (undocumented)
    getTotalStakedLQTY(overrides?: EthersCallOverrides): Promise<Decimal>;
    // (undocumented)
    getTotalStakedUniTokens(overrides?: EthersCallOverrides): Promise<Decimal>;
    // (undocumented)
    getTrove(address?: string, overrides?: EthersCallOverrides): Promise<UserTrove>;
    // (undocumented)
    getTroveBeforeRedistribution(address?: string, overrides?: EthersCallOverrides): Promise<TroveWithPendingRedistribution>;
    // @internal (undocumented)
    getTroves(params: TroveListingParams & {
        beforeRedistribution: true;
    }, overrides?: EthersCallOverrides): Promise<TroveWithPendingRedistribution[]>;
    // (undocumented)
    getTroves(params: TroveListingParams, overrides?: EthersCallOverrides): Promise<UserTrove[]>;
    // (undocumented)
    getUniTokenAllowance(address?: string, overrides?: EthersCallOverrides): Promise<Decimal>;
    // (undocumented)
    getUniTokenBalance(address?: string, overrides?: EthersCallOverrides): Promise<Decimal>;
    // (undocumented)
    getWitdrawsSpShare(withdrawAmount: Decimalish): Promise<string>;
    hasStore(): this is EthersLiquityWithStore;
    hasStore(store: "blockPolled"): this is EthersLiquityWithStore<BlockPolledLiquityStore>;
    // (undocumented)
    liquidate(address: string | string[], overrides?: EthersTransactionOverrides): Promise<LiquidationDetails>;
    // (undocumented)
    liquidateUpTo(maximumNumberOfTrovesToLiquidate: number, overrides?: EthersTransactionOverrides): Promise<LiquidationDetails>;
    // @internal (undocumented)
    _mintUniToken(amount: Decimalish, address?: string, overrides?: EthersTransactionOverrides): Promise<void>;
    // (undocumented)
    openTrove(params: TroveCreationParams<Decimalish>, maxBorrowingRateOrOptionalParams?: Decimalish | BorrowingOperationOptionalParams, overrides?: EthersTransactionOverrides): Promise<TroveCreationDetails>;
    readonly populate: PopulatableEthersLiquity;
    // (undocumented)
    redeemLUSD(amount: Decimalish, maxRedemptionRate?: Decimalish, overrides?: EthersTransactionOverrides): Promise<RedemptionDetails>;
    // (undocumented)
    registerFrontend(kickbackRate: Decimalish, overrides?: EthersTransactionOverrides): Promise<void>;
    // (undocumented)
    repayLUSD(amount: Decimalish, overrides?: EthersTransactionOverrides): Promise<TroveAdjustmentDetails>;
    readonly send: SendableEthersLiquity;
    // (undocumented)
    sendLQTY(toAddress: string, amount: Decimalish, overrides?: EthersTransactionOverrides): Promise<void>;
    // (undocumented)
    sendLUSD(toAddress: string, amount: Decimalish, overrides?: EthersTransactionOverrides): Promise<void>;
    // @internal (undocumented)
    setPrice(price: Decimalish, overrides?: EthersTransactionOverrides): Promise<void>;
    // (undocumented)
    stakeLQTY(amount: Decimalish, overrides?: EthersTransactionOverrides): Promise<void>;
    // (undocumented)
    stakeUniTokens(amount: Decimalish, overrides?: EthersTransactionOverrides): Promise<void>;
    // (undocumented)
    transferCollateralGainToTrove(overrides?: EthersTransactionOverrides): Promise<CollateralGainTransferDetails>;
    // (undocumented)
    unstakeLQTY(amount: Decimalish, overrides?: EthersTransactionOverrides): Promise<void>;
    // (undocumented)
    unstakeUniTokens(amount: Decimalish, overrides?: EthersTransactionOverrides): Promise<void>;
    // (undocumented)
    withdrawCollateral(amount: Decimalish, overrides?: EthersTransactionOverrides): Promise<TroveAdjustmentDetails>;
    // (undocumented)
    withdrawGainsFromStabilityPool(overrides?: EthersTransactionOverrides): Promise<StabilityPoolGainsWithdrawalDetails>;
    // (undocumented)
    withdrawGainsFromStaking(overrides?: EthersTransactionOverrides): Promise<void>;
    // (undocumented)
    withdrawLQTYRewardFromLiquidityMining(overrides?: EthersTransactionOverrides): Promise<void>;
    // (undocumented)
    withdrawLUSDFromStabilityPool(amount: Decimalish, overrides?: EthersTransactionOverrides): Promise<StabilityDepositChangeDetails>;
}

// @public
export interface EthersLiquityConnection extends EthersLiquityConnectionOptionalParams {
    // @internal (undocumented)
    readonly [brand]: unique symbol;
    readonly addresses: Record<string, string>;
    readonly bootstrapPeriod: number;
    readonly chainId: number;
    readonly deploymentDate: Date;
    // @internal (undocumented)
    readonly _isDev: boolean;
    readonly liquidityMiningLQTYRewardRate: Decimal;
    // @internal (undocumented)
    readonly _priceFeedIsTestnet: boolean;
    readonly provider: EthersProvider;
    readonly signer?: EthersSigner;
    readonly startBlock: number;
    readonly totalStabilityPoolLQTYReward: Decimal;
    readonly version: string;
}

// @public
export interface EthersLiquityConnectionOptionalParams {
    readonly frontendTag?: string;
    readonly userAddress?: string;
    readonly useStore?: EthersLiquityStoreOption;
}

// @public
export type EthersLiquityStoreOption = "blockPolled";

// @public
export interface EthersLiquityWithStore<T extends LiquityStore = LiquityStore> extends EthersLiquity {
    readonly store: T;
}

// @public
export type EthersPopulatedTransaction = PopulatedTransaction;

// @public
export type EthersProvider = Provider;

// @public
export type EthersSigner = Signer;

// @public
export class EthersTransactionCancelledError extends Error {
    // @internal
    constructor(rawError: _RawTransactionReplacedError);
    // (undocumented)
    readonly rawError: Error;
    // (undocumented)
    readonly rawReplacementReceipt: EthersTransactionReceipt;
}

// @public
export class EthersTransactionFailedError extends TransactionFailedError<FailedReceipt<EthersTransactionReceipt>> {
    constructor(message: string, failedReceipt: FailedReceipt<EthersTransactionReceipt>);
}

// @public
export interface EthersTransactionOverrides {
    // (undocumented)
    from?: string;
    // (undocumented)
    gasLimit?: BigNumberish;
    // (undocumented)
    gasPrice?: BigNumberish;
    // (undocumented)
    nonce?: BigNumberish;
}

// @public
export type EthersTransactionReceipt = TransactionReceipt;

// @public
export type EthersTransactionResponse = TransactionResponse;

// @alpha (undocumented)
export class ObservableEthersLiquity implements ObservableLiquity {
    constructor(readable: ReadableEthersLiquity);
    // (undocumented)
    watchLUSDBalance(onLUSDBalanceChanged: (balance: Decimal) => void, address?: string): () => void;
    // (undocumented)
    watchLUSDInStabilityPool(onLUSDInStabilityPoolChanged: (lusdInStabilityPool: Decimal) => void): () => void;
    // (undocumented)
    watchNumberOfTroves(onNumberOfTrovesChanged: (numberOfTroves: number) => void): () => void;
    // (undocumented)
    watchPrice(onPriceChanged: (price: Decimal) => void): () => void;
    // (undocumented)
    watchStabilityDeposit(onStabilityDepositChanged: (stabilityDeposit: StabilityDeposit) => void, address?: string): () => void;
    // (undocumented)
    watchTotal(onTotalChanged: (total: Trove) => void): () => void;
    // (undocumented)
    watchTotalRedistributed(onTotalRedistributedChanged: (totalRedistributed: Trove) => void): () => void;
    // (undocumented)
    watchTroveWithoutRewards(onTroveChanged: (trove: TroveWithPendingRedistribution) => void, address?: string): () => void;
}

// @public
export class PopulatableEthersLiquity implements PopulatableLiquity<EthersTransactionReceipt, EthersTransactionResponse, EthersPopulatedTransaction> {
    constructor(readable: ReadableEthersLiquity);
    // (undocumented)
    adjustTrove(params: TroveAdjustmentParams<Decimalish>, maxBorrowingRateOrOptionalParams?: Decimalish | BorrowingOperationOptionalParams, overrides?: EthersTransactionOverrides): Promise<PopulatedEthersLiquityTransaction<TroveAdjustmentDetails>>;
    // (undocumented)
    approveUniTokens(allowance?: Decimalish, overrides?: EthersTransactionOverrides): Promise<PopulatedEthersLiquityTransaction<void>>;
    // (undocumented)
    bammUnlock(overrides?: EthersTransactionOverrides): Promise<PopulatedEthersLiquityTransaction>;
    // (undocumented)
    borrowLUSD(amount: Decimalish, maxBorrowingRate?: Decimalish, overrides?: EthersTransactionOverrides): Promise<PopulatedEthersLiquityTransaction<TroveAdjustmentDetails>>;
    // (undocumented)
    claimCollateralSurplus(overrides?: EthersTransactionOverrides): Promise<PopulatedEthersLiquityTransaction<void>>;
    // (undocumented)
    closeTrove(overrides?: EthersTransactionOverrides): Promise<PopulatedEthersLiquityTransaction<TroveClosureDetails>>;
    // (undocumented)
    depositCollateral(amount: Decimalish, overrides?: EthersTransactionOverrides): Promise<PopulatedEthersLiquityTransaction<TroveAdjustmentDetails>>;
    // (undocumented)
    depositLUSDInStabilityPool(amount: Decimalish, frontendTag?: string, overrides?: EthersTransactionOverrides): Promise<PopulatedEthersLiquityTransaction<StabilityDepositChangeDetails>>;
    // (undocumented)
    exitLiquidityMining(overrides?: EthersTransactionOverrides): Promise<PopulatedEthersLiquityTransaction<void>>;
    // (undocumented)
    liquidate(address: string | string[], overrides?: EthersTransactionOverrides): Promise<PopulatedEthersLiquityTransaction<LiquidationDetails>>;
    // (undocumented)
    liquidateUpTo(maximumNumberOfTrovesToLiquidate: number, overrides?: EthersTransactionOverrides): Promise<PopulatedEthersLiquityTransaction<LiquidationDetails>>;
    // @internal (undocumented)
    _mintUniToken(amount: Decimalish, address?: string, overrides?: EthersTransactionOverrides): Promise<PopulatedEthersLiquityTransaction<void>>;
    // (undocumented)
    openTrove(params: TroveCreationParams<Decimalish>, maxBorrowingRateOrOptionalParams?: Decimalish | BorrowingOperationOptionalParams, overrides?: EthersTransactionOverrides): Promise<PopulatedEthersLiquityTransaction<TroveCreationDetails>>;
    // (undocumented)
    redeemLUSD(amount: Decimalish, maxRedemptionRate?: Decimalish, overrides?: EthersTransactionOverrides): Promise<PopulatedEthersRedemption>;
    // (undocumented)
    registerFrontend(kickbackRate: Decimalish, overrides?: EthersTransactionOverrides): Promise<PopulatedEthersLiquityTransaction<void>>;
    // (undocumented)
    repayLUSD(amount: Decimalish, overrides?: EthersTransactionOverrides): Promise<PopulatedEthersLiquityTransaction<TroveAdjustmentDetails>>;
    // (undocumented)
    sendLQTY(toAddress: string, amount: Decimalish, overrides?: EthersTransactionOverrides): Promise<PopulatedEthersLiquityTransaction<void>>;
    // (undocumented)
    sendLUSD(toAddress: string, amount: Decimalish, overrides?: EthersTransactionOverrides): Promise<PopulatedEthersLiquityTransaction<void>>;
    // @internal (undocumented)
    setPrice(price: Decimalish, overrides?: EthersTransactionOverrides): Promise<PopulatedEthersLiquityTransaction<void>>;
    // (undocumented)
    stakeLQTY(amount: Decimalish, overrides?: EthersTransactionOverrides): Promise<PopulatedEthersLiquityTransaction<void>>;
    // (undocumented)
    stakeUniTokens(amount: Decimalish, overrides?: EthersTransactionOverrides): Promise<PopulatedEthersLiquityTransaction<void>>;
    // (undocumented)
    transferCollateralGainToTrove(overrides?: EthersTransactionOverrides): Promise<PopulatedEthersLiquityTransaction<CollateralGainTransferDetails>>;
    // (undocumented)
    unstakeLQTY(amount: Decimalish, overrides?: EthersTransactionOverrides): Promise<PopulatedEthersLiquityTransaction<void>>;
    // (undocumented)
    unstakeUniTokens(amount: Decimalish, overrides?: EthersTransactionOverrides): Promise<PopulatedEthersLiquityTransaction<void>>;
    // (undocumented)
    withdrawCollateral(amount: Decimalish, overrides?: EthersTransactionOverrides): Promise<PopulatedEthersLiquityTransaction<TroveAdjustmentDetails>>;
    // (undocumented)
    withdrawGainsFromStabilityPool(overrides?: EthersTransactionOverrides): Promise<PopulatedEthersLiquityTransaction<StabilityPoolGainsWithdrawalDetails>>;
    // (undocumented)
    withdrawGainsFromStaking(overrides?: EthersTransactionOverrides): Promise<PopulatedEthersLiquityTransaction<void>>;
    // (undocumented)
    withdrawLQTYRewardFromLiquidityMining(overrides?: EthersTransactionOverrides): Promise<PopulatedEthersLiquityTransaction<void>>;
    // (undocumented)
    withdrawLUSDFromStabilityPool(amount: Decimalish, overrides?: EthersTransactionOverrides): Promise<PopulatedEthersLiquityTransaction<StabilityDepositChangeDetails>>;
    }

// @public
export class PopulatedEthersLiquityTransaction<T = unknown> implements PopulatedLiquityTransaction<EthersPopulatedTransaction, SentEthersLiquityTransaction<T>> {
    // @internal
    constructor(rawPopulatedTransaction: EthersPopulatedTransaction, connection: EthersLiquityConnection, parse: (rawReceipt: EthersTransactionReceipt) => T, gasHeadroom?: number);
    readonly gasHeadroom?: number;
    readonly rawPopulatedTransaction: EthersPopulatedTransaction;
    // (undocumented)
    send(): Promise<SentEthersLiquityTransaction<T>>;
}

// @public (undocumented)
export class PopulatedEthersRedemption extends PopulatedEthersLiquityTransaction<RedemptionDetails> implements PopulatedRedemption<EthersPopulatedTransaction, EthersTransactionResponse, EthersTransactionReceipt> {
    // @internal
    constructor(rawPopulatedTransaction: EthersPopulatedTransaction, connection: EthersLiquityConnection, attemptedLUSDAmount: Decimal, redeemableLUSDAmount: Decimal, increaseAmountByMinimumNetDebt?: (maxRedemptionRate?: Decimalish) => Promise<PopulatedEthersRedemption>);
    // (undocumented)
    readonly attemptedLUSDAmount: Decimal;
    // (undocumented)
    increaseAmountByMinimumNetDebt(maxRedemptionRate?: Decimalish): Promise<PopulatedEthersRedemption>;
    // (undocumented)
    readonly isTruncated: boolean;
    // (undocumented)
    readonly redeemableLUSDAmount: Decimal;
}

// @internal (undocumented)
export enum _RawErrorReason {
    // (undocumented)
    TRANSACTION_CANCELLED = "cancelled",
    // (undocumented)
    TRANSACTION_FAILED = "transaction failed",
    // (undocumented)
    TRANSACTION_REPLACED = "replaced",
    // (undocumented)
    TRANSACTION_REPRICED = "repriced"
}

// @internal (undocumented)
export interface _RawTransactionReplacedError extends Error {
    // (undocumented)
    cancelled: boolean;
    // (undocumented)
    code: ErrorCode.TRANSACTION_REPLACED;
    // (undocumented)
    hash: string;
    // (undocumented)
    reason: _RawErrorReason.TRANSACTION_CANCELLED | _RawErrorReason.TRANSACTION_REPLACED | _RawErrorReason.TRANSACTION_REPRICED;
    // (undocumented)
    receipt: EthersTransactionReceipt;
    // (undocumented)
    replacement: EthersTransactionResponse;
}

// @public
export class ReadableEthersLiquity implements ReadableLiquity {
    // @internal
    constructor(connection: EthersLiquityConnection);
    // @internal (undocumented)
    static connect(signerOrProvider: EthersSigner | EthersProvider, optionalParams: EthersLiquityConnectionOptionalParams & {
        useStore: "blockPolled";
    }): Promise<ReadableEthersLiquityWithStore<BlockPolledLiquityStore>>;
    // (undocumented)
    static connect(signerOrProvider: EthersSigner | EthersProvider, optionalParams?: EthersLiquityConnectionOptionalParams): Promise<ReadableEthersLiquity>;
    // (undocumented)
    readonly connection: EthersLiquityConnection;
    // @internal (undocumented)
    static _from(connection: EthersLiquityConnection & {
        useStore: "blockPolled";
    }): ReadableEthersLiquityWithStore<BlockPolledLiquityStore>;
    // @internal (undocumented)
    static _from(connection: EthersLiquityConnection): ReadableEthersLiquity;
    // @internal (undocumented)
    _getActivePool(overrides?: EthersCallOverrides): Promise<Trove>;
    // (undocumented)
    getBammAllowance(overrides?: EthersCallOverrides): Promise<boolean>;
    // @internal (undocumented)
    _getBlockTimestamp(blockTag?: BlockTag): Promise<number>;
    // (undocumented)
    getCollateralSurplusBalance(address?: string, overrides?: EthersCallOverrides): Promise<Decimal>;
    // @internal (undocumented)
    _getDefaultPool(overrides?: EthersCallOverrides): Promise<Trove>;
    // (undocumented)
    getFees(overrides?: EthersCallOverrides): Promise<Fees>;
    // @internal (undocumented)
    _getFeesFactory(overrides?: EthersCallOverrides): Promise<(blockTimestamp: number, recoveryMode: boolean) => Fees>;
    // (undocumented)
    getFrontendStatus(address?: string, overrides?: EthersCallOverrides): Promise<FrontendStatus>;
    // (undocumented)
    getLiquidityMiningLQTYReward(address?: string, overrides?: EthersCallOverrides): Promise<Decimal>;
    // (undocumented)
    getLiquidityMiningStake(address?: string, overrides?: EthersCallOverrides): Promise<Decimal>;
    // (undocumented)
    getLQTYBalance(address?: string, overrides?: EthersCallOverrides): Promise<Decimal>;
    // (undocumented)
    getLQTYStake(address?: string, overrides?: EthersCallOverrides): Promise<LQTYStake>;
    // (undocumented)
    getLUSDBalance(address?: string, overrides?: EthersCallOverrides): Promise<Decimal>;
    // (undocumented)
    getLUSDInStabilityPool(overrides?: EthersCallOverrides): Promise<Decimal>;
    // (undocumented)
    getNumberOfTroves(overrides?: EthersCallOverrides): Promise<number>;
    // (undocumented)
    getPrice(overrides?: EthersCallOverrides): Promise<Decimal>;
    // (undocumented)
    getRemainingLiquidityMiningLQTYReward(overrides?: EthersCallOverrides): Promise<Decimal>;
    // @internal (undocumented)
    _getRemainingLiquidityMiningLQTYRewardCalculator(overrides?: EthersCallOverrides): Promise<(blockTimestamp: number) => Decimal>;
    // (undocumented)
    getRemainingStabilityPoolLQTYReward(overrides?: EthersCallOverrides): Promise<Decimal>;
    // (undocumented)
    getStabilityDeposit(address?: string, overrides?: EthersCallOverrides): Promise<StabilityDeposit>;
    // (undocumented)
    getTotal(overrides?: EthersCallOverrides): Promise<Trove>;
    // (undocumented)
    getTotalRedistributed(overrides?: EthersCallOverrides): Promise<Trove>;
    // (undocumented)
    getTotalStakedLQTY(overrides?: EthersCallOverrides): Promise<Decimal>;
    // (undocumented)
    getTotalStakedUniTokens(overrides?: EthersCallOverrides): Promise<Decimal>;
    // (undocumented)
    getTrove(address?: string, overrides?: EthersCallOverrides): Promise<UserTrove>;
    // (undocumented)
    getTroveBeforeRedistribution(address?: string, overrides?: EthersCallOverrides): Promise<TroveWithPendingRedistribution>;
    // @internal (undocumented)
    getTroves(params: TroveListingParams & {
        beforeRedistribution: true;
    }, overrides?: EthersCallOverrides): Promise<TroveWithPendingRedistribution[]>;
    // (undocumented)
    getTroves(params: TroveListingParams, overrides?: EthersCallOverrides): Promise<UserTrove[]>;
    // (undocumented)
    getUniTokenAllowance(address?: string, overrides?: EthersCallOverrides): Promise<Decimal>;
    // (undocumented)
    getUniTokenBalance(address?: string, overrides?: EthersCallOverrides): Promise<Decimal>;
    // (undocumented)
    getWitdrawsSpShare(withdrawAmount: Decimalish): Promise<string>;
    hasStore(): this is ReadableEthersLiquityWithStore;
    hasStore(store: "blockPolled"): this is ReadableEthersLiquityWithStore<BlockPolledLiquityStore>;
}

// @public
export interface ReadableEthersLiquityWithStore<T extends LiquityStore = LiquityStore> extends ReadableEthersLiquity {
    readonly store: T;
}

// @internal (undocumented)
export const _redeemMaxIterations = 70;

// @public
export class SendableEthersLiquity implements SendableLiquity<EthersTransactionReceipt, EthersTransactionResponse> {
    constructor(populatable: PopulatableEthersLiquity);
    // (undocumented)
    adjustTrove(params: TroveAdjustmentParams<Decimalish>, maxBorrowingRateOrOptionalParams?: Decimalish | BorrowingOperationOptionalParams, overrides?: EthersTransactionOverrides): Promise<SentEthersLiquityTransaction<TroveAdjustmentDetails>>;
    // (undocumented)
    approveUniTokens(allowance?: Decimalish, overrides?: EthersTransactionOverrides): Promise<SentEthersLiquityTransaction<void>>;
    // (undocumented)
    bammUnlock(overrides?: EthersTransactionOverrides): Promise<SentEthersLiquityTransaction>;
    // (undocumented)
    borrowLUSD(amount: Decimalish, maxBorrowingRate?: Decimalish, overrides?: EthersTransactionOverrides): Promise<SentEthersLiquityTransaction<TroveAdjustmentDetails>>;
    // (undocumented)
    claimCollateralSurplus(overrides?: EthersTransactionOverrides): Promise<SentEthersLiquityTransaction<void>>;
    // (undocumented)
    closeTrove(overrides?: EthersTransactionOverrides): Promise<SentEthersLiquityTransaction<TroveClosureDetails>>;
    // (undocumented)
    depositCollateral(amount: Decimalish, overrides?: EthersTransactionOverrides): Promise<SentEthersLiquityTransaction<TroveAdjustmentDetails>>;
    // (undocumented)
    depositLUSDInStabilityPool(amount: Decimalish, frontendTag?: string, overrides?: EthersTransactionOverrides): Promise<SentEthersLiquityTransaction<StabilityDepositChangeDetails>>;
    // (undocumented)
    exitLiquidityMining(overrides?: EthersTransactionOverrides): Promise<SentEthersLiquityTransaction<void>>;
    // (undocumented)
    liquidate(address: string | string[], overrides?: EthersTransactionOverrides): Promise<SentEthersLiquityTransaction<LiquidationDetails>>;
    // (undocumented)
    liquidateUpTo(maximumNumberOfTrovesToLiquidate: number, overrides?: EthersTransactionOverrides): Promise<SentEthersLiquityTransaction<LiquidationDetails>>;
    // @internal (undocumented)
    _mintUniToken(amount: Decimalish, address?: string, overrides?: EthersTransactionOverrides): Promise<SentEthersLiquityTransaction<void>>;
    // (undocumented)
    openTrove(params: TroveCreationParams<Decimalish>, maxBorrowingRateOrOptionalParams?: Decimalish | BorrowingOperationOptionalParams, overrides?: EthersTransactionOverrides): Promise<SentEthersLiquityTransaction<TroveCreationDetails>>;
    // (undocumented)
    redeemLUSD(amount: Decimalish, maxRedemptionRate?: Decimalish, overrides?: EthersTransactionOverrides): Promise<SentEthersLiquityTransaction<RedemptionDetails>>;
    // (undocumented)
    registerFrontend(kickbackRate: Decimalish, overrides?: EthersTransactionOverrides): Promise<SentEthersLiquityTransaction<void>>;
    // (undocumented)
    repayLUSD(amount: Decimalish, overrides?: EthersTransactionOverrides): Promise<SentEthersLiquityTransaction<TroveAdjustmentDetails>>;
    // (undocumented)
    sendLQTY(toAddress: string, amount: Decimalish, overrides?: EthersTransactionOverrides): Promise<SentEthersLiquityTransaction<void>>;
    // (undocumented)
    sendLUSD(toAddress: string, amount: Decimalish, overrides?: EthersTransactionOverrides): Promise<SentEthersLiquityTransaction<void>>;
    // @internal (undocumented)
    setPrice(price: Decimalish, overrides?: EthersTransactionOverrides): Promise<SentEthersLiquityTransaction<void>>;
    // (undocumented)
    stakeLQTY(amount: Decimalish, overrides?: EthersTransactionOverrides): Promise<SentEthersLiquityTransaction<void>>;
    // (undocumented)
    stakeUniTokens(amount: Decimalish, overrides?: EthersTransactionOverrides): Promise<SentEthersLiquityTransaction<void>>;
    // (undocumented)
    transferCollateralGainToTrove(overrides?: EthersTransactionOverrides): Promise<SentEthersLiquityTransaction<CollateralGainTransferDetails>>;
    // (undocumented)
    unstakeLQTY(amount: Decimalish, overrides?: EthersTransactionOverrides): Promise<SentEthersLiquityTransaction<void>>;
    // (undocumented)
    unstakeUniTokens(amount: Decimalish, overrides?: EthersTransactionOverrides): Promise<SentEthersLiquityTransaction<void>>;
    // (undocumented)
    withdrawCollateral(amount: Decimalish, overrides?: EthersTransactionOverrides): Promise<SentEthersLiquityTransaction<TroveAdjustmentDetails>>;
    // (undocumented)
    withdrawGainsFromStabilityPool(overrides?: EthersTransactionOverrides): Promise<SentEthersLiquityTransaction<StabilityPoolGainsWithdrawalDetails>>;
    // (undocumented)
    withdrawGainsFromStaking(overrides?: EthersTransactionOverrides): Promise<SentEthersLiquityTransaction<void>>;
    // (undocumented)
    withdrawLQTYRewardFromLiquidityMining(overrides?: EthersTransactionOverrides): Promise<SentEthersLiquityTransaction<void>>;
    // (undocumented)
    withdrawLUSDFromStabilityPool(amount: Decimalish, overrides?: EthersTransactionOverrides): Promise<SentEthersLiquityTransaction<StabilityDepositChangeDetails>>;
}

// @public
export class SentEthersLiquityTransaction<T = unknown> implements SentLiquityTransaction<EthersTransactionResponse, LiquityReceipt<EthersTransactionReceipt, T>> {
    // @internal
    constructor(rawSentTransaction: EthersTransactionResponse, connection: EthersLiquityConnection, parse: (rawReceipt: EthersTransactionReceipt) => T);
    // (undocumented)
    getReceipt(): Promise<LiquityReceipt<EthersTransactionReceipt, T>>;
    readonly rawSentTransaction: EthersTransactionResponse;
    // (undocumented)
    waitForReceipt(): Promise<MinedReceipt<EthersTransactionReceipt, T>>;
}

// @internal (undocumented)
export interface _TroveChangeWithFees<T> {
    // (undocumented)
    fee: Decimal;
    // (undocumented)
    newTrove: Trove;
    // (undocumented)
    params: T;
}

// @public
export class UnsupportedNetworkError extends Error {
    // @internal
    constructor(chainId: number);
    readonly chainId: number;
}


// (No @packageDocumentation comment for this package)

```
