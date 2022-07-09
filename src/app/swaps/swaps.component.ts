import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { SwapsService } from '../swaps.service';
import { Version } from '../models/version';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { SwapResponse } from '../models/swap-response';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-swaps',
  templateUrl: './swaps.component.html',
  styleUrls: ['./swaps.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class SwapsComponent implements OnInit {

  swapsForm!: FormGroup
  swapResponse!: SwapResponse
  version!: Version
  sourceWallet: string = environment.sourceWallet

  constructor(private swaps: SwapsService, private fb: FormBuilder) {
    let prefix = new RegExp(`^[${environment.swapAddressPrefix}]{2}`)
    console.log(prefix)
    this.swapsForm = this.fb.group({
      transactionId: new FormControl('', [Validators.required, Validators.minLength(environment.transactionIdLength), Validators.maxLength(environment.transactionIdLength)]),
      swapAddress: new FormControl('', [Validators.required, Validators.minLength(environment.swapAddressLength), Validators.maxLength(environment.swapAddressLength), Validators.pattern(prefix)])
    })
   }

  ngOnInit(): void {
    this.swaps.getVersion().subscribe(versionInfo => {
      this.version = versionInfo
    })
  }

  submit() {
    this.swaps.submitSwap(this.swapsForm.value).subscribe(swap => {
      this.swapsForm.patchValue({transactionId: ''})
      this.swapResponse = swap
    })
  }

}
