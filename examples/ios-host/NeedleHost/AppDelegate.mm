#import "AppDelegate.h"
#import "ViewController.h"
#import <Lynx/LynxEnv.h>

@implementation AppDelegate

- (BOOL)application:(UIApplication *)application
    didFinishLaunchingWithOptions:(NSDictionary<UIApplicationLaunchOptionsKey, id> *)launchOptions {
  // Touch the singleton so Lynx performs its global setup.
  (void)[LynxEnv sharedInstance];

  self.window = [[UIWindow alloc] initWithFrame:[UIScreen mainScreen].bounds];
  self.window.rootViewController = [[ViewController alloc] init];
  self.window.backgroundColor = [UIColor blackColor];
  [self.window makeKeyAndVisible];
  return YES;
}

@end
