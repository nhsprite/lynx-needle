package com.lynxneedle.host;

import com.journeyapps.barcodescanner.CaptureActivity;
import com.journeyapps.barcodescanner.DecoratedBarcodeView;

/**
 * QR capture screen: portrait-locked (manifest) with a custom dark layout.
 * zxing's own orientationLocked option only pins whatever orientation is
 * current when the scanner opens, which could still be landscape.
 */
public class PortraitCaptureActivity extends CaptureActivity {
  @Override
  protected DecoratedBarcodeView initializeContent() {
    setContentView(R.layout.activity_scan);
    return findViewById(R.id.zxing_barcode_scanner);
  }
}
