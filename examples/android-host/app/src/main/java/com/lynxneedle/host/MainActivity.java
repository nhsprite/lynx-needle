package com.lynxneedle.host;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Toast;
import androidx.activity.ComponentActivity;
import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.core.content.ContextCompat;
import com.journeyapps.barcodescanner.ScanContract;
import com.journeyapps.barcodescanner.ScanOptions;
import com.lynx.tasm.LynxView;
import com.lynx.tasm.LynxViewBuilder;
import com.lynx.tasm.TemplateData;
import com.lynxneedle.sdk.LynxNeedle;
import java.util.HashMap;

/**
 * Minimal host: scan the QR code printed by the Rspeedy dev server
 * (`npm run dev` in examples/lynx-needle-demo) to load the Lynx page.
 * Pressing back while a page is loaded returns to the scan state.
 */
public class MainActivity extends ComponentActivity {
  private ViewGroup container;
  private View emptyState;
  private LynxView lynxView;

  private final ActivityResultLauncher<ScanOptions> scanLauncher =
      registerForActivityResult(
          new ScanContract(),
          result -> {
            if (result.getContents() != null) {
              load(result.getContents().trim());
            }
          });

  private final ActivityResultLauncher<String> cameraPermission =
      registerForActivityResult(
          new ActivityResultContracts.RequestPermission(),
          granted -> {
            if (granted) {
              startScan();
            } else {
              Toast.makeText(this, "Camera permission is required to scan QR codes",
                  Toast.LENGTH_LONG).show();
            }
          });

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    setContentView(R.layout.activity_main);

    container = findViewById(R.id.lynx_container);
    emptyState = findViewById(R.id.empty_state);
    findViewById(R.id.scan_button).setOnClickListener(v -> maybeStartScan());

    // Back with a page loaded = unload and return to the scan state.
    getOnBackPressedDispatcher()
        .addCallback(
            this,
            new OnBackPressedCallback(true) {
              @Override
              public void handleOnBackPressed() {
                if (lynxView != null) {
                  unload();
                } else {
                  setEnabled(false);
                  getOnBackPressedDispatcher().onBackPressed();
                }
              }
            });

    // Automation hook: `am start -n com.lynxneedle.host/.MainActivity --es url <bundle-url>`
    handleIntentUrl(getIntent());
  }

  @Override
  protected void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    handleIntentUrl(intent);
  }

  private void handleIntentUrl(Intent intent) {
    if (intent == null) return;
    String url = intent.getStringExtra("url");
    if (url != null && !url.isEmpty()) {
      load(url.trim());
    }
  }

  private void maybeStartScan() {
    if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
        == PackageManager.PERMISSION_GRANTED) {
      startScan();
    } else {
      cameraPermission.launch(Manifest.permission.CAMERA);
    }
  }

  private void startScan() {
    ScanOptions options = new ScanOptions();
    options.setDesiredBarcodeFormats(ScanOptions.QR_CODE);
    options.setBeepEnabled(false);
    options.setOrientationLocked(false);
    options.setCaptureActivity(PortraitCaptureActivity.class);
    scanLauncher.launch(options);
  }

  private void load(String url) {
    unload();
    lynxView = new LynxViewBuilder().build(this);
    LynxNeedle.attach(lynxView);
    container.addView(lynxView);
    lynxView.renderTemplateUrl(url, TemplateData.fromMap(new HashMap<>()));
    emptyState.setVisibility(View.GONE);
  }

  private void unload() {
    if (lynxView != null) {
      container.removeView(lynxView);
      lynxView.destroy();
      lynxView = null;
    }
    emptyState.setVisibility(View.VISIBLE);
  }

  @Override
  protected void onDestroy() {
    if (lynxView != null) {
      lynxView.destroy();
      lynxView = null;
    }
    super.onDestroy();
  }
}
