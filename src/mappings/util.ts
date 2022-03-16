export function bigIntStr(hex: string): string {
    return BigInt(hex).toString(10)
}