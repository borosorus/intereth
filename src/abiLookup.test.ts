import {AbiLookupError, fetchVerifiedAbi} from "./abiLookup";

const ADDRESS = "0x0000000000000000000000000000000000000001";
const ABI = [{type: "function", name: "value", inputs: [], outputs: [{type: "uint256"}], stateMutability: "view"}];

function response(status: number, payload: unknown): Response {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: jest.fn().mockResolvedValue(payload),
    } as unknown as Response;
}

describe("fetchVerifiedAbi", () => {
    const originalFetch = global.fetch;

    afterEach(() => {
        global.fetch = originalFetch;
        jest.restoreAllMocks();
    });

    it("returns a Sourcify ABI without querying Blockscout", async () => {
        global.fetch = jest.fn().mockResolvedValue(response(200, {abi: ABI}));

        await expect(fetchVerifiedAbi({address: ADDRESS, chainId: "1", signal: new AbortController().signal}))
            .resolves.toEqual({abi: ABI, source: "Sourcify"});
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it("falls back to the configured Blockscout instance", async () => {
        global.fetch = jest.fn()
            .mockResolvedValueOnce(response(404, {}))
            .mockResolvedValueOnce(response(200, {status: "1", result: JSON.stringify(ABI)}));

        await expect(fetchVerifiedAbi({address: ADDRESS, chainId: "8453", signal: new AbortController().signal}))
            .resolves.toEqual({abi: ABI, source: "Blockscout"});
        expect(global.fetch).toHaveBeenNthCalledWith(
            2,
            `https://base.blockscout.com/api?module=contract&action=getabi&address=${ADDRESS}`,
            expect.objectContaining({signal: expect.any(AbortSignal)}),
        );
    });

    it("does not query Blockscout when the chain has no configured instance", async () => {
        global.fetch = jest.fn().mockResolvedValue(response(404, {}));

        await expect(fetchVerifiedAbi({address: ADDRESS, chainId: "999999", signal: new AbortController().signal}))
            .rejects.toMatchObject<Partial<AbiLookupError>>({kind: "not-found"});
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it("reports provider failures separately from an unverified contract", async () => {
        global.fetch = jest.fn()
            .mockResolvedValueOnce(response(500, {}))
            .mockResolvedValueOnce(response(200, {status: "0", result: "Contract source code not verified"}));

        await expect(fetchVerifiedAbi({address: ADDRESS, chainId: "1", signal: new AbortController().signal}))
            .rejects.toMatchObject<Partial<AbiLookupError>>({kind: "unavailable"});
    });

    it("propagates cancellation without falling back", async () => {
        const controller = new AbortController();
        global.fetch = jest.fn().mockImplementation(async () => {
            controller.abort();
            throw new DOMException("Aborted", "AbortError");
        });

        await expect(fetchVerifiedAbi({address: ADDRESS, chainId: "1", signal: controller.signal}))
            .rejects.toMatchObject({name: "AbortError"});
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });
});
