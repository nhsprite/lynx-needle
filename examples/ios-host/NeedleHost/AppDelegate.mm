#import "AppDelegate.h"
#import "ViewController.h"
#import <Lynx/LynxEnv.h>

// Keeps the addon's static Node-API registration entry alive at link time.
// Provided by the `needle` pod (include/addon_use.h).
#include "addon_use.h"

// PrimJS and LynxWeakNodeAPI expose a C bridge for sharing the weak Node-API
// raw host pointer at app startup (mirrors the LynxExplorer AppDelegate).
extern "C" {
typedef const void *(*PrimJSWeakNodeApiRawPtrHostProvider)(void);
void PrimJSInstallWeakNodeApiRawPtrHostProvider(PrimJSWeakNodeApiRawPtrHostProvider provider);
void SetupWeakNodeApiEnv(void);
const void *PrimJSGetWeakNodeApiRawPtrHost(void);
}

static const void *PrimJSProvideWeakNodeApiRawPtrHost(void) {
  return PrimJSGetWeakNodeApiRawPtrHost();
}

static void InstallPrimJSWeakNodeApiBridge(void) {
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    // Register PrimJS as the raw host provider before Lynx creates any runtime.
    PrimJSInstallWeakNodeApiRawPtrHostProvider(PrimJSProvideWeakNodeApiRawPtrHost);
    // Initialize the weak Node-API side once so later runtimes can reuse it.
    SetupWeakNodeApiEnv();
  });
}

@implementation AppDelegate

- (BOOL)application:(UIApplication *)application
    didFinishLaunchingWithOptions:(NSDictionary<UIApplicationLaunchOptionsKey, id> *)launchOptions {
  InstallPrimJSWeakNodeApiBridge();
  // Touch the singleton so Lynx performs its global setup.
  (void)[LynxEnv sharedInstance];

  self.window = [[UIWindow alloc] initWithFrame:[UIScreen mainScreen].bounds];
  self.window.rootViewController = [[ViewController alloc] init];
  self.window.backgroundColor = [UIColor blackColor];
  [self.window makeKeyAndVisible];
  return YES;
}

@end
