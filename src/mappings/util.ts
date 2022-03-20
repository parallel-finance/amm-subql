export function bigIntStr(hex: string): string {
    return BigInt(hex).toString(10)
}

export function parseId(id: string): number {
    return Number(id.replace(',', ''))
}