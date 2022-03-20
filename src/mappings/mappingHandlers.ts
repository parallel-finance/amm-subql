import { SubstrateEvent, SubstrateBlock } from "@subql/types";
import { AssetValue, LiquidityPool, Pool } from "../types";
import { handleAddLiquidity, handleCreatePool, handleRmoveLiquidity, handleSwapTrade } from './ammHandler'
import { bigIntStr, parseId } from "./util";


async function handlePool(pkeys: any[], blockNumber: number, timestamp: Date) {
    try {
        let kps = []
        let poolQueries = []
        pkeys.map(k => {
            const kp = (k.toHuman() as string[]).map(s => parseId(s))
            kps.push(kp)
            poolQueries.push(api.query.amm.pools(kp[0], kp[1]))
        })
        const poolRes = await Promise.all(poolQueries)

        for (let ind in poolRes) {
            const kp = kps[ind]
            const {
                baseAmount,
                quoteAmount,
                baseAmountLast,
                quoteAmountLast,
                lpTokenId,
                blockTimestampLast,
                price0CumulativeLast,
                price1CumulativeLast
            } = poolRes[ind].toJSON()

            const t = (new Date(timestamp)).valueOf() / 1000
            const lpid = `${lpTokenId}-${blockNumber}-${t}`
            const pool = await Pool.get(lpTokenId)
            if (!pool) {
                await Pool.create({
                    id: `${lpTokenId}`,
                    blockHeight: blockNumber,
                    trader: '',
                    baseTokenId: kp[0],
                    quoteTokenId: kp[1],
                    timestamp
                }).save()
            }
            const record = LiquidityPool.create({
                id: lpid,
                blockHeight: blockNumber,
                poolId: lpTokenId,
                action: 'Polling',
                baseVolume: bigIntStr(baseAmount),
                quoteVolume: bigIntStr(quoteAmount),
                baseVolumeLast: bigIntStr(baseAmountLast),
                quoteVolumnLase: bigIntStr(quoteAmountLast),
                basePriceCumulativeLast: bigIntStr(price0CumulativeLast),
                quotePriceCumulativeLast: bigIntStr(price1CumulativeLast),
                blockTimestampLast,
                timestamp,
            })
            record.save()
        }
    } catch (e: any) {
        logger.error(`handle pool info error: ${e.message}`)
    }
}

async function handleValue(vkeys: any[], blockNumber: number) {
    try {
        let pars = []
        let valueQueries = []
        for (let k of vkeys) {
            let [owner, assetId] = k.toHuman() as any[]
            assetId = parseId(assetId)
            pars.push([owner, assetId])
            valueQueries.push(api.query.oracle.rawValues(owner, assetId))
        }

        const valueRes = await Promise.all(valueQueries)

        for (let ind in valueRes) {
            const owner = pars[ind][0]
            const assetId = pars[ind][1]
            const {
                value,
                timestamp
            } = valueRes[ind].toJSON() as any
            AssetValue.create({
                id: `${blockNumber}-${owner}-${assetId}`,
                account: owner,
                assetId,
                value: bigIntStr(value),
                blockTimevalue: Math.floor(timestamp / 1000).toString()
            }).save()
        }
    } catch (e: any) {
        logger.error(`handle asset value polling error: ${e.message}`)
    }
}

export async function handleBlock(block: SubstrateBlock): Promise<void> {
    try {
        const blockNumber = block.block.header.number.toNumber()
        const timestamp = block.timestamp
        const [pkeys, vkeys] = await Promise.all([
            api.query.amm.pools.keys(),
            api.query.oracle.rawValues.keys()
        ])
        await Promise.all([
            handlePool(pkeys, blockNumber, timestamp),
            handleValue(vkeys, blockNumber)
        ])
    } catch (e: any) {
        logger.error(`block error: %o`, e.message)
    }
}

export async function handleEvent(event: SubstrateEvent): Promise<void> {
    const { event: { data } } = event;
    const method = event.event.method
    const jsdata = JSON.parse(data.toString())
    const ext = event.extrinsic.extrinsic
    const hash = ext.hash.toString()
    const block = event.block.block.header.number.toNumber()
    const timestamp = event.block.timestamp
    const handleOptions = { data: jsdata, block, timestamp, hash }

    logger.info(`start to handle event[${method}]`)
    switch (method) {
        case 'LiquidityAdded':
            await handleAddLiquidity(handleOptions)
            break
        case 'LiquidityRemoved':
            await handleRmoveLiquidity(handleOptions)
            break
        case 'PoolCreated':
            await handleCreatePool(handleOptions)
            break
        case 'Traded':
            await handleSwapTrade(handleOptions)
            break
        default:
            logger.error(`unknow event[${method}] to handle`)
    }
}

