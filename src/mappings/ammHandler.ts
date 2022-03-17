import { bigIntStr } from './util'
import { LiquidityPool, ContributeLiquidity, RemoveLiquidity, Pool, SwapTrade } from '../types'

type LiquidityRemoved = {
    sender: string,
    base_currency_id: number,
    quote_currency_id: number,
    liquidity: string,
    base_amount_removed: string,
    quote_amount_removed: string,
    lp_token_id: number,
    new_base_amount: string,
    new_quote_amount: string
}

type LiquidityAdded = {
    sender: string,
    base_currency_id: number,
    quote_currency_id: number,
    base_amount_added: number,
    quote_amount_added: number,
    lp_token_id: number,
    new_base_amount: number,
    new_quote_amount: number
}

type Traded = {
    trader: string,
    currency_id_in: number,
    currency_id_out: number,
    amount_in: string,
    amount_out: string,
    lp_token_id: number,
    new_quote_amount: string,
    new_base_amount: string
}

type PoolCreated = {
    trader: string,
    currency_id_in: number,
    currency_id_out: number,
    lp_token_id: number
}

export type HandleOptions = {
    data: any[],
    block: number,
    hash: string,
    timestamp: Date
}

// assets.asset(assetId)

// amm.pools.keys()

export async function getPoolsPair() {
    const keys = await api.query.amm.pools.keys()
    const pairs = keys.map(k => {
        const pair = k.toHuman()
        return {
            baseTokenId: Number(pair[0]),
            quoteTokenId: Number(pair[1])
        }
    })
    logger.warn(`get pool pairs: %o`, pairs)
}

type PoolOption = {
    lp_token_id: string,
    block: number,
    base_currency_id: number,
    quote_currency_id: number,
    new_base_amount: string,
    new_quote_amount: string,
    timestamp: Date
}

async function handlePoolRecord(opt: PoolOption): Promise<string> {
    const { 
        lp_token_id,
        block,
        base_currency_id,
        quote_currency_id,
        new_base_amount,
        new_quote_amount,
        timestamp
    } = opt
    const lpid = `${lp_token_id}-${block}`
    const pool = await Pool.get(lp_token_id)
    if (!pool) {
        await Pool.create({
            id: `${lp_token_id}`,
            blockHeight: opt.block,
            trader: '',
            baseTokenId: base_currency_id,
            quoteTokenId: quote_currency_id,
            timestamp
        }).save()
    }
    await LiquidityPool.create({
        id: lpid,
        blockHeight: opt.block,
        poolId: lp_token_id,
        baseTokenVolume: new_base_amount,
        quoteTokenVolume: new_quote_amount,
        timestamp
    }).save()
    return lpid
}

export async function handleAddLiquidity(opt: HandleOptions) {
    try {
        const [
            sender,
            base_currency_id,
            quote_currency_id,
            base_amount_added,
            quote_amount_added,
            lp_token_id,
            new_base_amount,
            new_quote_amount
        ] = opt.data
        const lpid = await handlePoolRecord({
            lp_token_id,
            block: opt.block,
            base_currency_id,
            quote_currency_id,
            new_base_amount,
            new_quote_amount,
            timestamp: opt.timestamp
        })

        ContributeLiquidity.create({
            id: opt.hash,
            sender,
            blockHeight: opt.block,
            poolId: lpid,
            timestamp: opt.timestamp,
            baseAmountAdded: base_amount_added,
            quoteAmountAdded: quote_amount_added
        }).save()
    } catch (e: any) {
        logger.error(`handle liquidity add error: %o`, e.message)
    }
}

export async function handleRmoveLiquidity(opt: HandleOptions) {
    const [
        sender,
        base_currency_id,
        quote_currency_id,
        liquidity,
        base_amount_removed,
        quote_amount_removed,
        lp_token_id,
        new_base_amount,
        new_quote_amount
    ] = opt.data
    const lpid = await handlePoolRecord({
        lp_token_id,
        block: opt.block,
        base_currency_id,
        quote_currency_id,
        new_base_amount,
        new_quote_amount,
        timestamp: opt.timestamp
    })
    RemoveLiquidity.create({
        id: opt.hash,
        sender,
        blockHeight: opt.block,
        poolId: lpid,
        liquidity,
        baseAmountRemoved: base_amount_removed,
        quoteAmountRemoved: quote_amount_removed,
        timestamp: opt.timestamp
    }).save()
}

export async function handleCreatePool(opt: HandleOptions) {
    const [
        trader,
        currency_id_in,
        currency_id_out,
        lp_token_id
    ] = opt.data
    const pool = await Pool.get(`${lp_token_id}`)
    if (!pool) {
        Pool.create({
            id: `${lp_token_id}`,
            trader,
            baseTokenId: currency_id_in,
            quoteTokenId: currency_id_out,
            blockHeight: opt.block,
            timestamp: opt.timestamp
        }).save()
    } else {
        pool.trader = trader
        pool.blockHeight = opt.block
        pool.timestamp = opt.timestamp
        pool.save()
    }
}

export async function handleSwapTrade(opt: HandleOptions) {
    const [
        trader,
        currency_id_in,
        currency_id_out,
        amount_in,
        amount_out,
        lp_token_id,
        new_quote_amount,
        new_base_amount
    ] = opt.data
    const lpid = await handlePoolRecord({
        lp_token_id,
        block: opt.block,
        base_currency_id: currency_id_in,
        quote_currency_id: currency_id_out,
        new_base_amount,
        new_quote_amount,
        timestamp: opt.timestamp
    })
    SwapTrade.create({
        id: opt.hash,
        trader,
        blockHeight: opt.block,
        poolId: lpid,
        tokenFrom: currency_id_in,
        tokenTo: currency_id_out,
        amountFrom: amount_in,
        amountTo: amount_out,
        timestamp: opt.timestamp
    }).save()
}