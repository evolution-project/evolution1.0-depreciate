import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { SwapsService } from '../swaps.service';
import { Version } from '../models/version';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { SwapResponse } from '../models/swap-response';

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

  constructor(private swaps: SwapsService, private fb: FormBuilder) {
    this.swapsForm = this.fb.group({
      transactionId: new FormControl('', [Validators.required]),
      newWalletAddress: new FormControl('', [Validators.required])
    })
   }

  ngOnInit(): void {
    this.swaps.getVersion().subscribe(versionInfo => {
      this.version = versionInfo
    })
  }

  submit() {
    this.swaps.submitSwap(this.swapsForm.value).subscribe(swap => {
      this.swapResponse = swap
    })
  }

}
