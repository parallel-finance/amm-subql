import {SubstrateEvent,SubstrateBlock} from "@subql/types";
import { LiquidityPool } from "../types";
import {HandleOptions, handleAddLiquidity, handleCreatePool, handleRmoveLiquidity, handleSwapTrade, getPoolsPair} from './ammHandler'


export async function handleBlock(block: SubstrateBlock): Promise<void> {
    //Create a new starterEntity with ID using block hash
    //Record block number
    // const keys = await api.query.oracle.rawValues.keys()
    // await getPoolsPair()
    // logger.warn(`raw value keys: ${keys.length}`)

}

export async function handleEvent(event: SubstrateEvent): Promise<void> {
    const {event: {data}} = event;
    const method = event.event.method
    const jsdata = JSON.parse(data.toString())
    const ext = event.extrinsic.extrinsic
    const hash = ext.hash.toString()
    const block = event.block.block.header.number.toNumber()
    const timestamp = event.block.timestamp
    const handleOptions = {data: jsdata, block, timestamp, hash}

    logger.info(`start to handle event[${method}]`)
    switch(method) {
        case 'LiquidityAdded':
            handleAddLiquidity(handleOptions)
            break
        case 'LiquidityRemoved':
            handleRmoveLiquidity(handleOptions)
            break
        case 'PoolCreated':
            handleCreatePool(handleOptions)
            break
        case 'Traded':
            handleSwapTrade(handleOptions)
            break
        default:
            logger.error(`unknow event[${method}] to handle`)
    }
}

