package com.lynxneedle.host;

import com.lynx.tasm.provider.AbsTemplateProvider;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/** Minimal HTTP template provider — the SDK requires one for renderTemplateUrl. */
public class SimpleTemplateProvider extends AbsTemplateProvider {
  @Override
  public void loadTemplate(String url, final Callback callback) {
    new Thread(() -> {
      try {
        HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
        conn.setConnectTimeout(10000);
        conn.setReadTimeout(15000);
        InputStream in = conn.getInputStream();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[8192];
        int n;
        while ((n = in.read(buf)) != -1) {
          out.write(buf, 0, n);
        }
        in.close();
        conn.disconnect();
        callback.onSuccess(out.toByteArray());
      } catch (Exception e) {
        callback.onFailed(String.valueOf(e));
      }
    }, "template-loader").start();
  }
}
