export function shortenizeAddr(addr: string) {
    if (addr.length <= 12) {
        return addr;
    }
    return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
