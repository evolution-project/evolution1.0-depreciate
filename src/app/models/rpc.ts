export interface RPCRequest<RequestType> 
{
    jsonrpc: string
    id: string
    method: string
    params?: RequestType
}

export interface RPCResponse<ResultType>
{
    id: string
    jsonrpc: string
    result: ResultType
}