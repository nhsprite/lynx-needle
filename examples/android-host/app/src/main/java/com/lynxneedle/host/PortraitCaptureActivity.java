package com.lynxneedle.host;

import com.journeyapps.barcodescanner.CaptureActivity;

/**
 * QR capture screen forced to portrait (declared with
 * android:screenOrientation="portrait" in the manifest). zxing's own
 * orientationLocked option only pins whatever orientation is current when the
 * scanner opens, which can still be landscape.
 */
public class PortraitCaptureActivity extends CaptureActivity {}
