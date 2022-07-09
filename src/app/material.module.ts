import { NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { MatMenuModule } from '@angular/material/menu'
import { MatToolbarModule } from '@angular/material/toolbar'
import { MatButtonModule } from '@angular/material/button'
import { MatIconModule } from '@angular/material/icon'
import { MatDividerModule } from '@angular/material/divider'
import { MatStepperModule } from '@angular/material/stepper'
import { MatRadioModule } from '@angular/material/radio'
import { MatFormFieldModule } from '@angular/material/form-field'
import { MatInputModule } from '@angular/material/input'
import { MatExpansionModule } from '@angular/material/expansion'
import { MatCheckboxModule } from '@angular/material/checkbox'
import {MatCardModule} from '@angular/material/card'
import { ClipboardModule } from '@angular/cdk/clipboard'

const material = [
  MatMenuModule,
  MatToolbarModule,
  MatButtonModule,
  MatIconModule,
  MatDividerModule,
  MatStepperModule,
  MatRadioModule,
  MatFormFieldModule,
  MatInputModule,
  MatExpansionModule,
  MatCheckboxModule,
  MatCardModule,
  ClipboardModule
]


@NgModule({
  declarations: [],
  imports: [CommonModule, ...material],
  exports: [...material]
})
export class MaterialModule { }
