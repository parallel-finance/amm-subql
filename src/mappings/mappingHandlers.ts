import { SubstrateEvent, SubstrateBlock } from '@subql/types';
import { u32, StorageKey } from '@polkadot/types';
import { AssetValue, LiquidityPool, Pool } from '../types';
import {
  handleAddLiquidity,
  handleCreatePool,
  handleRmoveLiquidity,
  handleSwapTrade
} from './ammHandler';
import { bigIntStr, handlePolicy } from './util';
import { getLptokens } from './lpTokenPriceHandler';
import BigNumber from 'bignumber.js';

const relayAssetId = (api.consts.crowdloans.relayCurrency as u32).toString();

async function handlePool(pkeys: string[][], blockNumber: number, timestamp: Date) {
  try {
    let kps = [];
    let poolQueries = [];
    pkeys.map(kp => {
      kps.push(kp);
      poolQueries.push(api.query.amm.pools(...kp));
    });
    const poolRes = await Promise.all(poolQueries);

    for (let ind in poolRes) {
      const kp = kps[ind];
      const {
        baseAmount,
        quoteAmount,
        baseAmountLast,
        quoteAmountLast,
        lpTokenId,
        blockTimestampLast,
        price0CumulativeLast,
        price1CumulativeLast
      } = poolRes[ind].toJSON();

      const t = new Date(timestamp).valueOf() / 1000;
      const lpid = `${lpTokenId}-${blockNumber}-${t}`;
      const pool = await Pool.get(lpTokenId);
      if (!pool) {
        await Pool.create({
          id: `${lpTokenId}`,
          blockHeight: blockNumber,
          trader: '',
          baseTokenId: kp[0],
          quoteTokenId: kp[1],
          timestamp
        }).save();
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
        timestamp
      });
      logger.debug(`dump new pool info at[${blockNumber}] pool[${lpTokenId}]`);
      await record.save();
    }
  } catch (e: any) {
    logger.error(`handle pool info error: ${e.message}`);
  }
}

async function handleValue(vkeys: any[], blockNumber: number) {
  try {
    // wrap api query
    let pars = [];
    let valueQueries = [];
    for (let k of vkeys) {
      pars.push(k);
      valueQueries.push(api.query.oracle.rawValues(...k));
    }

    const valueRes = await Promise.all(valueQueries);

    // group by assetId
    let groups = {};
    for (let ind in pars) {
      const assetId = pars[ind][1];
      groups[assetId] = groups[assetId] || [];
      groups[assetId].push(valueRes[ind]);
    }

    for (let assetId of Object.keys(groups)) {
      // sort by value
      groups[assetId].sort((a, b) => {
        const ja = a.toJSON();
        const jb = b.toJSON();
        const n = Number(BigInt(ja.value) - BigInt(jb.value));
        return n;
      });
      const grp = groups[assetId];
      const len = grp.length;
      const isEven = len % 2 === 0;
      let dat: { value: string; timestamp: number };
      // handle middle
      if (isEven) {
        const ind = Math.floor(len / 2);
        const it1 = JSON.parse(grp[ind]);
        const it2 = JSON.parse(grp[ind - 1]);
        //
        dat = {
          value: ((BigInt(it1.value) + BigInt(it2.value)) / BigInt(2)).toString(),
          timestamp: it1.timestamp
        };
      } else {
        const { value, timestamp } = JSON.parse(grp[Math.floor(len / 2)]);
        dat = {
          value: BigInt(value).toString(),
          timestamp
        };
      }

      if (assetId === relayAssetId) {
        const lptokens = await getLptokens();

        const lpRecords = lptokens.map(lp => {
          const value = new BigNumber(lp.baseAssetAmount)
            .times(dat.value)
            .times(2)
            .dividedBy(lp.supply);

          return AssetValue.create({
            id: `${blockNumber}-${lp.id}`,
            blockHeight: blockNumber,
            assetId: Number(lp.id),
            value: parseInt(value.toString()).toString(),
            blockTimevalue: Math.floor(dat.timestamp / 1000).toString()
          });
        });
        lpRecords.forEach(record => record.save());
      }

      const record = AssetValue.create({
        id: `${blockNumber}-${assetId}`,
        blockHeight: blockNumber,
        assetId: Number(assetId),
        value: dat.value,
        blockTimevalue: Math.floor(dat.timestamp / 1000).toString()
      });
      logger.info(
        `dump new asset value at[${blockNumber}] assetId[${assetId}] value[${dat.value}]`
      );
      await record.save();
    }
  } catch (e: any) {
    logger.error(`handle asset value polling error: ${e.message} ${e.name}`);
  }
}

export async function handleBlock(block: SubstrateBlock): Promise<void> {
  try {
    const blockNumber = block.block.header.number.toNumber();
    const timestamp = block.timestamp;
    if (!handlePolicy(timestamp)) {
      return;
    }
    logger.info(`start to handle block[${blockNumber}]: ${timestamp}`);
    const [pkeys, vkeys] = await Promise.all([
      api.query.amm.pools.keys(),
      api.query.oracle.rawValues.keys()
    ]);

    await Promise.all([
      handlePool(
        pkeys.map(({ args: [v1, v2] }) => [v1.toString(), v2.toString()]),
        blockNumber,
        timestamp
      ),
      handleValue(
        vkeys.map(({ args: [v1, v2] }) => [v1.toString(), v2.toString()]),
        blockNumber
      )
    ]);
  } catch (e: any) {
    logger.error(`block error: %o`, e.message);
  }
}

export async function handleEvent(event: SubstrateEvent): Promise<void> {
  const {
    event: { data }
  } = event;
  const method = event.event.method;
  const jsdata = JSON.parse(data.toString());
  const ext = event.extrinsic.extrinsic;
  const hash = ext.hash.toString();
  const block = event.block.block.header.number.toNumber();
  const timestamp = event.block.timestamp;
  const handleOptions = { data: jsdata, block, timestamp, hash };

  logger.info(`start to handle event[${method}]`);
  switch (method) {
    case 'LiquidityAdded':
      await handleAddLiquidity(handleOptions);
      break;
    case 'LiquidityRemoved':
      await handleRmoveLiquidity(handleOptions);
      break;
    case 'PoolCreated':
      await handleCreatePool(handleOptions);
      break;
    case 'Traded':
      await handleSwapTrade(handleOptions);
      break;
    default:
      logger.error(`unknow event[${method}] to handle`);
  }
}
