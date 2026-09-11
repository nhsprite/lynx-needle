#import "ViewController.h"
#import <Lynx/LynxView.h>
#import <Lynx/LynxViewBuilder.h>

// Default: the rspeedy dev server of examples/lynx-needle-demo.
static NSString *const kDefaultURL = @"http://127.0.0.1:3001/main.lynx.bundle";

static NSString *NeedleHostURLOverride(void) {
  NSProcessInfo *processInfo = [NSProcessInfo processInfo];
  NSString *envURL = processInfo.environment[@"NEEDLE_BUNDLE_URL"];
  if (envURL.length > 0) {
    return envURL;
  }

  NSArray<NSString *> *arguments = processInfo.arguments;
  for (NSUInteger i = 0; i + 1 < arguments.count; i++) {
    NSString *argument = arguments[i];
    if ([argument isEqualToString:@"--url"] || [argument isEqualToString:@"-url"]) {
      NSString *url = arguments[i + 1];
      if (url.length > 0) {
        return url;
      }
    }
  }

  return nil;
}

static NSString *NeedleHostBundledTemplatePath(void) {
  return [[NSBundle mainBundle] pathForResource:@"main.lynx" ofType:@"bundle"];
}

@interface ViewController ()
@property(nonatomic, strong) LynxView *lynxView;
@end

@implementation ViewController

- (void)viewDidLoad {
  [super viewDidLoad];
  self.view.backgroundColor = [UIColor blackColor];
}

- (void)viewDidAppear:(BOOL)animated {
  [super viewDidAppear:animated];
  if (!self.lynxView) {
    [self reload];
  }
}

- (void)reload {
  [self.lynxView removeFromSuperview];

  CGRect frame = self.view.bounds;
  self.lynxView = [[LynxView alloc] initWithBuilderBlock:^(LynxViewBuilder *_Nonnull builder) {
    builder.frame = frame;
    builder.screenSize = frame.size;
  }];
  self.lynxView.frame = frame;
  self.lynxView.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
  [self.view addSubview:self.lynxView];

  NSString *urlString = NeedleHostURLOverride();
  if (!urlString) {
    NSString *bundledTemplatePath = NeedleHostBundledTemplatePath();
    if (bundledTemplatePath.length > 0) {
      NSData *data = [NSData dataWithContentsOfFile:bundledTemplatePath];
      if (data) {
        NSString *templateURL = [[NSURL fileURLWithPath:bundledTemplatePath] absoluteString];
        NSLog(@"[NeedleHost] loaded bundled template %@", templateURL);
        [self.lynxView loadTemplate:data withURL:templateURL];
        return;
      }
    }
    urlString = kDefaultURL;
  }

  NSURL *url = [NSURL URLWithString:urlString];

  __weak ViewController *weakSelf = self;
  [[[NSURLSession sharedSession]
        dataTaskWithURL:url
      completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
        dispatch_async(dispatch_get_main_queue(), ^{
          ViewController *strongSelf = weakSelf;
          if (!strongSelf || !data) {
            NSLog(@"[NeedleHost] failed to fetch %@: %@", urlString, error);
            return;
          }
          NSLog(@"[NeedleHost] loaded remote template %@", urlString);
          [strongSelf.lynxView loadTemplate:data withURL:urlString];
        });
      }] resume];
}

- (void)viewDidLayoutSubviews {
  [super viewDidLayoutSubviews];
  self.lynxView.frame = self.view.bounds;
  [self.lynxView updateViewportWithPreferredLayoutWidth:self.view.bounds.size.width
                                  preferredLayoutHeight:self.view.bounds.size.height];
}

@end
