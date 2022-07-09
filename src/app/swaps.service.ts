import { Injectable } from '@angular/core'
import { Observable } from 'rxjs'
import { RPCRequest, RPCResponse } from './models/rpc'
import { Version } from './models/version'
import { HttpClient } from '@angular/common/http'
import { Swap } from './models/swap'
import { SwapResponse } from './models/swap-response'
import { environment } from 'src/environments/environment'


@Injectable({
  providedIn: 'root'
})
export class SwapsService {
  swapApi: string = 'api/swap'

  swapsService: string = environment.swapsService

  constructor(private httpClient: HttpClient) { }

  public submitSwap(swap: Swap) : Observable<SwapResponse> {
    const headers = { 'content-type': 'application/json; charset=UTF-8'}  
    return this.httpClient.post<SwapResponse>(`${this.swapsService}/${this.swapApi}`, swap, {'headers': headers})
  }

}
