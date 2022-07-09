export interface SwapResponse {
    transfers: Array<Transaction>
}

export interface Transaction {
    amount: number
    global_index: number
    key_image: string
    spent: boolean
    subaddr_index: object
    tx_hash: string
    unlocked: boolean
}