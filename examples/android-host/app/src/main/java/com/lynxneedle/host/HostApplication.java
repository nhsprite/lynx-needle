package com.lynxneedle.host;

import android.app.Application;
import com.lynx.service.http.LynxHttpService;
import com.lynx.service.log.LynxLogService;
import com.lynx.tasm.LynxEnv;
import com.lynx.tasm.library.LynxAutolinkGenerated;
import com.lynx.tasm.service.LynxServiceCenter;

public class HostApplication extends Application {
  @Override
  public void onCreate() {
    super.onCreate();

    LynxServiceCenter.inst().registerService(LynxLogService.INSTANCE);
    LynxServiceCenter.inst().registerService(LynxHttpService.INSTANCE);

    LynxEnv.inst().init(this, null, new SimpleTemplateProvider(), null);
    LynxAutolinkGenerated.setupGlobal(this);
  }
}
