#import "ViewController.h"
#import <Lynx/LynxBackgroundRuntime.h>
#import <Lynx/LynxBackgroundRuntimeOptions.h>
#import <Lynx/LynxView.h>
#import <Lynx/LynxViewBuilder.h>
#import "LynxNodeAPILifecycleListener.h"
#import "LynxNodeAPIModule.h"

// Default: the rspeedy dev server of examples/lynx-needle-demo.
static NSString *const kDefaultURL = @"http://100.82.246.36:3001/main.lynx.bundle";

@interface ViewController ()
@property(nonatomic, strong) UITextField *urlField;
@property(nonatomic, strong) LynxView *lynxView;
@property(nonatomic, strong) LynxBackgroundRuntime *runtime;
@property(nonatomic, strong) LynxNodeAPILifecycleListener *listener;
@property(nonatomic, strong) NSObject *moduleToken;
@end

@implementation ViewController

- (void)viewDidLoad {
  [super viewDidLoad];
  self.view.backgroundColor = [UIColor blackColor];

  UIView *bar = [[UIView alloc] init];
  bar.backgroundColor = [UIColor colorWithWhite:0.12 alpha:1];
  bar.translatesAutoresizingMaskIntoConstraints = NO;
  [self.view addSubview:bar];

  self.urlField = [[UITextField alloc] init];
  self.urlField.text = kDefaultURL;
  self.urlField.borderStyle = UITextBorderStyleRoundedRect;
  self.urlField.keyboardType = UIKeyboardTypeURL;
  self.urlField.autocapitalizationType = UITextAutocapitalizationTypeNone;
  self.urlField.autocorrectionType = UITextAutocorrectionTypeNo;
  self.urlField.translatesAutoresizingMaskIntoConstraints = NO;
  [bar addSubview:self.urlField];

  UIButton *go = [UIButton buttonWithType:UIButtonTypeSystem];
  [go setTitle:@"GO" forState:UIControlStateNormal];
  go.translatesAutoresizingMaskIntoConstraints = NO;
  [go addTarget:self action:@selector(reload) forControlEvents:UIControlEventTouchUpInside];
  [bar addSubview:go];

  UILayoutGuide *safe = self.view.safeAreaLayoutGuide;
  [NSLayoutConstraint activateConstraints:@[
    [bar.topAnchor constraintEqualToAnchor:safe.topAnchor],
    [bar.leadingAnchor constraintEqualToAnchor:self.view.leadingAnchor],
    [bar.trailingAnchor constraintEqualToAnchor:self.view.trailingAnchor],
    [bar.heightAnchor constraintEqualToConstant:56],

    [self.urlField.leadingAnchor constraintEqualToAnchor:bar.leadingAnchor constant:12],
    [self.urlField.centerYAnchor constraintEqualToAnchor:bar.centerYAnchor],
    [go.leadingAnchor constraintEqualToAnchor:self.urlField.trailingAnchor constant:8],
    [go.trailingAnchor constraintEqualToAnchor:bar.trailingAnchor constant:-12],
    [go.centerYAnchor constraintEqualToAnchor:bar.centerYAnchor],
    [go.widthAnchor constraintEqualToConstant:56],
  ]];
}

- (void)viewDidAppear:(BOOL)animated {
  [super viewDidAppear:animated];
  if (!self.lynxView) {
    [self reload];
  }
}

- (void)reload {
  [self.lynxView removeFromSuperview];

  // One background runtime per view, with the NAPI module + lifecycle listener
  // wired through a shared token (mirrors the LynxExplorer iOS sample).
  self.moduleToken = [NSObject new];
  LynxBackgroundRuntimeOptions *options = [[LynxBackgroundRuntimeOptions alloc] init];
  self.runtime = [[LynxBackgroundRuntime alloc] initWithOptions:options];
  self.listener = [[LynxNodeAPILifecycleListener alloc] initWithToken:self.moduleToken];
  [self.runtime addRuntimeLifecycleListener:self.listener];
  [self.runtime registerModule:[LynxNodeAPIModule class] param:self.moduleToken];

  LynxBackgroundRuntime *runtime = self.runtime;
  self.lynxView = [[LynxView alloc] initWithBuilderBlock:^(LynxViewBuilder *_Nonnull builder) {
    builder.lynxBackgroundRuntime = runtime;
  }];
  self.lynxView.translatesAutoresizingMaskIntoConstraints = NO;
  [self.view addSubview:self.lynxView];

  NSString *urlString = self.urlField.text.length ? self.urlField.text : kDefaultURL;
  NSURL *url = [NSURL URLWithString:urlString];

  __weak typeof(self) weakSelf = self;
  [[[NSURLSession sharedSession]
        dataTaskWithURL:url
      completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
        dispatch_async(dispatch_get_main_queue(), ^{
          __strong typeof(self) self = weakSelf;
          if (!self || !data) {
            NSLog(@"[NeedleHost] failed to fetch %@: %@", urlString, error);
            return;
          }
          [self.lynxView loadTemplate:data withURL:urlString];
        });
      }] resume];
}

- (void)viewDidLayoutSubviews {
  [super viewDidLayoutSubviews];
  // Pin the LynxView below the URL bar.
  CGFloat top = self.view.safeAreaInsets.top + 56;
  self.lynxView.frame = CGRectMake(0, top, self.view.bounds.size.width,
                                   self.view.bounds.size.height - top);
}

@end
