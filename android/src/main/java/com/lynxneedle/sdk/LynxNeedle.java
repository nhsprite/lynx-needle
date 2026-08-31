package com.lynxneedle.sdk;

import com.lynx.jsbridge.RuntimeLifecycleListener;
import com.lynx.tasm.LynxEnv;
import com.lynx.tasm.LynxView;

/**
 * One-stop entry for integrating the needle NAPI addon loader into a Lynx
 * host app:
 *
 * <pre>
 *   // once, during app startup (after LynxEnv.init):
 *   LynxNeedle.registerModule();
 *
 *   // per LynxView, after LynxViewBuilder.build():
 *   LynxNeedle.attach(lynxView);
 * </pre>
 *
 * Requires a Lynx runtime built with enable_napi_binding=true; the published
 * Maven SDK binaries do not include it (onRuntimeAttach never fires there).
 */
public final class LynxNeedle {
  private LynxNeedle() {}

  /** Globally registers the "LynxNodeAPI" module visible to page JS. */
  public static void registerModule() {
    LynxEnv.inst().registerModule("LynxNodeAPI", LynxNodeAPIModule.class);
  }

  /**
   * Attaches a runtime lifecycle listener so the module can bind the
   * runtime-specific napi_env. Call after LynxViewBuilder.build(), before or
   * after rendering; the runtime replays the attach event for late listeners.
   */
  public static void attach(final LynxView lynxView) {
    lynxView.addRuntimeLifecycleListener(new RuntimeLifecycleListener() {
      @Override
      public void onRuntimeAttach(long napiEnv) {
        LynxNodeAPIModule.putEnv(lynxView.getLynxContext(), napiEnv);
      }

      @Override
      public void onRuntimeDetach() {
        LynxNodeAPIModule.removeEnv(lynxView.getLynxContext());
      }
    });
  }
}
