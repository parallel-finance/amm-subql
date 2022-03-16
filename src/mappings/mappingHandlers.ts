import {SubstrateEvent,SubstrateBlock} from "@subql/types";
import { LiquidityPool } from "../types";
import { GenericEventData } from "@polkadot/types";


export async function handleBlock(block: SubstrateBlock): Promise<void> {
    //Create a new starterEntity with ID using block hash
    //Record block number

}

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

// LiquidityAdded LiquidityRemoved Traded
// 

function handleAddLiquidity(data: GenericEventData): LiquidityAdded {
    const jsdata = JSON.parse(data.toString()) 
    const [
        sender,
        base_currency_id,
        quote_currency_id,
        base_amount_added,
        quote_amount_added,
        lp_token_id,
        new_base_amount,
        new_quote_amount
    ] = jsdata
    return {
        sender,
        base_currency_id,
        quote_currency_id,
        base_amount_added,
        quote_amount_added,
        lp_token_id,
        new_base_amount,
        new_quote_amount
    }
}
export async function handleEvent(event: SubstrateEvent): Promise<void> {
    const {event: {data}} = event;
    const method = event.event.method

    switch(method) {
        case 'LiquidityAdded':
            const re = handleAddLiquidity(data)
            logger.warn(`${method} parse result: %o`, re)
            break
        case 'LiquidityRemoved':
            break
        case 'PoolCreated':
            break
        case 'Traded':
            break
    }

}

