package com.lynxneedle.host;

import android.app.Activity;
import android.os.Bundle;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.EditText;
import com.lynx.tasm.LynxView;
import com.lynx.tasm.LynxViewBuilder;
import com.lynx.tasm.TemplateData;
import com.lynxneedle.sdk.LynxNeedle;
import java.util.HashMap;

public class MainActivity extends Activity {
  // Default: the rspeedy dev server of examples/lynx-needle-demo.
  private static final String DEFAULT_URL =
      "http://100.82.246.36:3001/main.lynx.bundle";

  private ViewGroup container;
  private LynxView lynxView;

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    setContentView(R.layout.activity_main);

    container = findViewById(R.id.lynx_container);
    EditText urlInput = findViewById(R.id.url_input);
    urlInput.setText(DEFAULT_URL);
    Button go = findViewById(R.id.go_button);
    go.setOnClickListener(v -> load(urlInput.getText().toString().trim()));

    load(DEFAULT_URL);
  }

  private void load(String url) {
    if (lynxView != null) {
      container.removeView(lynxView);
      lynxView.destroy();
      lynxView = null;
    }

    lynxView = new LynxViewBuilder().build(this);
    LynxNeedle.attach(lynxView);
    container.addView(lynxView);
    lynxView.renderTemplateUrl(url, TemplateData.fromMap(new HashMap<>()));
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
