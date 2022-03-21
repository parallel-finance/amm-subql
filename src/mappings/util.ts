import Mom from "moment"

const utcTime = (timestamp: Date, keepLocalTime: boolean = false) => Mom(timestamp).utc(keepLocalTime)

function now() {
    return Mom().utc(false)
}

type TimeUnit = 'months' | 'weeks'| 'days' | 'hours' | 'minutes' | 'seconds'

function diffTime(timestamp: Date, unit: TimeUnit = 'days'): number {
    return now().diff(utcTime(timestamp), unit)
}

function startOf(timestamp: Date, unit: TimeUnit = 'days') {
    return utcTime(timestamp).startOf(unit)
}

function endOf(timestamp: Date, unit: TimeUnit = 'days') {
    return utcTime(timestamp).endOf(unit)
}

function hitEndOfDay(timestamp: Date): boolean {
    return endOf(timestamp).diff(timestamp, 'seconds') <= 12
}

function hitTime(timestamp: Date, off: number) {
    const startHour = startOf(timestamp, 'hours')
    const flag = utcTime(timestamp).diff(startHour, 'seconds') <= 12
    if (!flag) return flag
    if (off === 1 && flag) return true

    if (startHour.diff(now().startOf('days')) % off === 0) {
        return true
    }
    return false
}

function hitBlockTime(timestamp: Date, unit: TimeUnit = 'days'): boolean {
    return utcTime(timestamp).diff(startOf(timestamp, unit), 'seconds') <= 12
}

enum SnapshotPolicy {
    Daily,
    Hour4,
    Hourly,
    Blockly
}

function getPolicy(timestamp: Date): SnapshotPolicy {
    const diffMonths = diffTime(timestamp, 'months')
    if (diffMonths >= 1) {
        // keep daily snapshot at startOf-day & endof-day
        return SnapshotPolicy.Daily
    }
    const diffDays = diffTime(timestamp, 'days')
    if (diffDays > 7) {
        // keep 4-hour snapshot
        return SnapshotPolicy.Hour4
    }

    if (diffDays <= 7 && diffDays > 1) {
        // keep hourly snapshot
        return SnapshotPolicy.Hourly
    }
    // keep block snapshot
    return SnapshotPolicy.Blockly
}

export function handlePolicy(timestamp: Date): boolean {
    try {
        if (hitEndOfDay(timestamp)) return true
        const policy = getPolicy(timestamp)
        switch (policy) {
            case SnapshotPolicy.Daily:
                if (hitBlockTime(timestamp)) {
                    logger.debug(`daily snapshot policy`)
                    return true
                }
                break
            case SnapshotPolicy.Hour4:
                if (hitTime(timestamp, 4)) {
                    logger.debug(`hour-4 snapshot policy`)
                    return true
                }
                break
            case SnapshotPolicy.Hourly:
                if (hitTime(timestamp, 1)) {
                    logger.debug(`hourly snapshot policy`)
                    return true
                }
                break
            case SnapshotPolicy.Blockly:
                logger.debug(`blockly snapshot policy`)
                return true
        }
        return false
    } catch (e: any) {
        logger.error(`handle block policy error: ${e.message}`)
        return true
    }
}

export function bigIntStr(hex: string): string {
    return BigInt(hex).toString(10)
}

export function parseId(id: string): number {
    return Number(id.replace(',', ''))
}