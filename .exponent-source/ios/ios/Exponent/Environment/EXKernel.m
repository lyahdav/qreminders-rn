// Copyright 2015-present 650 Industries. All rights reserved.

#import "EXAnalytics.h"
#import "EXAppState.h"
#import "EXDevMenuViewController.h"
#import "EXFrame.h"
#import "EXKernel.h"
#import "EXKernelBridgeRecord.h"
#import "EXKernelModule.h"
#import "EXLinkingManager.h"
#import "EXManifestResource.h"
#import "EXShellManager.h"
#import "EXVersions.h"
#import "EXViewController.h"

#import <React/RCTBridge+Private.h>
#import <React/RCTEventDispatcher.h>
#import <React/RCTModuleData.h>
#import <React/RCTUtils.h>

NS_ASSUME_NONNULL_BEGIN

NSString *kEXKernelErrorDomain = @"EXKernelErrorDomain";
NSString *kEXKernelOpenUrlNotification = @"EXKernelOpenUrlNotification";
NSString *kEXKernelRefreshForegroundTaskNotification = @"EXKernelRefreshForegroundTaskNotification";
NSString *kEXKernelGetPushTokenNotification = @"EXKernelGetPushTokenNotification";
NSString *kEXKernelShouldForegroundTaskEvent = @"foregroundTask";
NSString * const kEXDeviceInstallUUIDKey = @"EXDeviceInstallUUIDKey";

@interface EXKernel ()

@property (nonatomic, weak) EXViewController *vcExponentRoot;

@end

@implementation EXKernel

+ (instancetype)sharedInstance
{
  static EXKernel *theKernel;
  static dispatch_once_t once;
  dispatch_once(&once, ^{
    if (!theKernel) {
      theKernel = [[EXKernel alloc] init];
    }
  });
  return theKernel;
}

- (instancetype)init
{
  if (self = [super init]) {
    _bridgeRegistry = [[EXKernelBridgeRegistry alloc] init];
    [[NSNotificationCenter defaultCenter] addObserver:self
                                             selector:@selector(_routeUrl:)
                                                 name:kEXKernelOpenUrlNotification
                                               object:nil];
    [[NSNotificationCenter defaultCenter] addObserver:self
                                             selector:@selector(_refreshForegroundTask:)
                                                 name:kEXKernelRefreshForegroundTaskNotification
                                               object:nil];
    for (NSString *name in @[UIApplicationDidBecomeActiveNotification,
                             UIApplicationDidEnterBackgroundNotification,
                             UIApplicationDidFinishLaunchingNotification,
                             UIApplicationWillResignActiveNotification,
                             UIApplicationWillEnterForegroundNotification]) {
      
      [[NSNotificationCenter defaultCenter] addObserver:self
                                               selector:@selector(_handleAppStateDidChange:)
                                                   name:name
                                                 object:nil];
    }
    NSLog(@"Exponent iOS Client Version %@", [[[NSBundle mainBundle] infoDictionary] objectForKey:@"EXClientVersion"]);
  }
  return self;
}

- (void)dealloc
{
  [[NSNotificationCenter defaultCenter] removeObserver:self];
}

- (void)sendNotification:(NSDictionary *)notifBody
      toExperienceWithId:(NSString *)experienceId
          fromBackground:(BOOL)isFromBackground
                isRemote:(BOOL)isRemote
{
  id destinationBridge = _bridgeRegistry.kernelBridge;
  for (id bridge in [_bridgeRegistry bridgeEnumerator]) {
    EXKernelBridgeRecord *bridgeRecord = [_bridgeRegistry recordForBridge:bridge];
    if (bridgeRecord.experienceId && [bridgeRecord.experienceId isEqualToString:experienceId]) {
      destinationBridge = bridge;
      break;
    }
  }
  // if the notification came from the background, in most but not all cases, this means the user acted on an iOS notification
  // and caused the app to launch.
  // From SO:
  // > Note that "App opened from Notification" will be a false positive if the notification is sent while the user is on a different
  // > screen (for example, if they pull down the status bar and then receive a notification from your app).
  NSDictionary *bodyWithOrigin = @{
                                   @"origin": (isFromBackground) ? @"selected" : @"received",
                                   @"remote": @(isRemote),
                                   @"data": notifBody,
                                   };
  if (destinationBridge) {
    if (destinationBridge == _bridgeRegistry.kernelBridge) {
      // send both the body and the experience id, so we can open a new experience from the kernel
      [self _dispatchJSEvent:@"Exponent.notification"
                        body:@{
                               @"body": bodyWithOrigin,
                               @"experienceId": experienceId,
                               }
                    onBridge:_bridgeRegistry.kernelBridge];
    } else {
      // send the body to the already-open experience
      [self _dispatchJSEvent:@"Exponent.notification" body:bodyWithOrigin onBridge:destinationBridge];
      [self _moveBridgeToForeground:destinationBridge];
    }
  }
}

- (void)registerRootExponentViewController:(EXViewController *)exponentViewController
{
  _vcExponentRoot = exponentViewController;
}

- (EXViewController *)rootViewController
{
  return _vcExponentRoot;
}

- (UIInterfaceOrientationMask)supportedInterfaceOrientationsForForegroundTask
{
  if (_bridgeRegistry.lastKnownForegroundBridge) {
    if (_bridgeRegistry.lastKnownForegroundBridge != _bridgeRegistry.kernelBridge) {
      EXKernelBridgeRecord *foregroundBridgeRecord = [_bridgeRegistry recordForBridge:_bridgeRegistry.lastKnownForegroundBridge];
      if (foregroundBridgeRecord.frame) {
        return [foregroundBridgeRecord.frame supportedInterfaceOrientations];
      }
    }
  }
  // kernel or unknown bridge: lock to portrait
  return UIInterfaceOrientationMaskPortrait;
}

#pragma mark - Linking

- (void)_refreshForegroundTask:(NSNotification *)notif
{
  id notifBridge = notif.userInfo[@"bridge"];
  if ([notifBridge respondsToSelector:@selector(parentBridge)]) {
    notifBridge = [notifBridge parentBridge];
  }
  if (notifBridge == _bridgeRegistry.kernelBridge) {
    DDLogError(@"Can't use ExponentUtil.reload() on the kernel bridge. Use RN dev tools to reload the bundle.");
    return;
  }
  if (notifBridge == _bridgeRegistry.lastKnownForegroundBridge) {
    // only the foreground task is allowed to force a reload
    [self dispatchKernelJSEvent:@"refresh" body:@{} onSuccess:nil onFailure:nil];
  }
}

/**
 *  Expected notif.userInfo keys:
 *   url - the url (NSString) to route
 *   bridge - (optional) if this event came from a bridge, a pointer to that bridge
 */
- (void)_routeUrl: (NSNotification *)notif
{
  NSURL *notifUri = [NSURL URLWithString:notif.userInfo[@"url"]];
  if (!notifUri) {
    DDLogInfo(@"Tried to route invalid url: %@", notif.userInfo[@"url"]);
    return;
  }
  NSString *urlToRoute = [[self class] _uriTransformedForRouting:notifUri].absoluteString;
  
  // kernel bridge is our default handler for this url
  // because it can open a new bridge if we don't already have one.
  id destinationBridge = _bridgeRegistry.kernelBridge;

  for (id bridge in [_bridgeRegistry bridgeEnumerator]) {
    EXKernelBridgeRecord *bridgeRecord = [_bridgeRegistry recordForBridge:bridge];
    if ([urlToRoute hasPrefix:[[self class] linkingUriForExperienceUri:bridgeRecord.frame.initialUri]]) {
      // this is a link into a bridge we already have running.
      // use this bridge as the link's destination instead of the kernel.
      destinationBridge = bridge;
      break;
    }
  }
  
  if (destinationBridge) {
    // fire a Linking url event on this (possibly versioned) bridge
    id linkingModule = [self _nativeModuleForBridge:destinationBridge named:@"LinkingManager"];
    if (!linkingModule) {
      DDLogError(@"Could not find the Linking module to open URL (%@)", urlToRoute);
    } else if ([linkingModule respondsToSelector:@selector(dispatchOpenUrlEvent:)]) {
      [linkingModule dispatchOpenUrlEvent:[NSURL URLWithString:urlToRoute]];
    } else {
      DDLogError(@"Linking module doesn't support the API we use to open URL (%@)", urlToRoute);
    }
    [self _moveBridgeToForeground:destinationBridge];
  }
}

+ (NSString *)linkingUriForExperienceUri:(NSURL *)uri
{
  uri = [self _uriTransformedForRouting:uri];
  NSURLComponents *components = [NSURLComponents componentsWithURL:uri resolvingAgainstBaseURL:YES];

  // if the provided uri is the shell app manifest uri,
  // this should have been transformed into customscheme://+deep-link
  // and then all we do here is strip off the deep-link part, leaving +.
  if ([EXShellManager sharedInstance].isShell && [[EXShellManager sharedInstance] isShellUrlScheme:components.scheme]) {
    return [NSString stringWithFormat:@"%@://", components.scheme];
  }

  NSMutableString* path = [NSMutableString stringWithString:components.path];

  // if the uri already contains a deep link, strip everything specific to that
  NSRange deepLinkRange = [path rangeOfString:@"+"];
  if (deepLinkRange.length > 0) {
    path = [[path substringToIndex:deepLinkRange.location] mutableCopy];
  }

  if (path.length == 0 || [path characterAtIndex:path.length - 1] != '/') {
    [path appendString:@"/"];
  }
  [path appendString:@"+"];
  components.path = path;

  components.query = nil;

  return [components string];
}

+ (NSURL *)_uriTransformedForRouting: (NSURL *)uri
{
  if (!uri) {
    return nil;
  }
  
  NSURL *normalizedUri = [self _uriNormalizedForRouting:uri];
  
  if ([EXShellManager sharedInstance].isShell && [EXShellManager sharedInstance].hasUrlScheme) {
    // if the provided uri is the shell app manifest uri,
    // transform this into customscheme://deep-link
    if ([self _isShellManifestUrl:normalizedUri]) {
      NSString *uriString = normalizedUri.absoluteString;
      NSRange deepLinkRange = [uriString rangeOfString:@"+"];
      NSString *deepLink = @"";
      if (deepLinkRange.length > 0) {
        deepLink = [uriString substringFromIndex:deepLinkRange.location + 1];
      }
      NSString *result = [NSString stringWithFormat:@"%@://%@", [EXShellManager sharedInstance].urlScheme, deepLink];
      return [NSURL URLWithString:result];
    }
  }
  return normalizedUri;
}

+ (NSURL *)_uriNormalizedForRouting: (NSURL *)uri
{
  NSURLComponents *components = [NSURLComponents componentsWithURL:uri resolvingAgainstBaseURL:YES];
  
  if ([EXShellManager sharedInstance].isShell && [[EXShellManager sharedInstance] isShellUrlScheme:components.scheme]) {
    // if we're a shell and this uri had the shell scheme, leave it alone.
  } else {
    if ([components.scheme isEqualToString:@"https"]) {
      components.scheme = @"exps";
    } else {
      components.scheme = @"exp";
    }
  }
  
  if ([components.scheme isEqualToString:@"exp"] && [components.port integerValue] == 80) {
    components.port = nil;
  } else if ([components.scheme isEqualToString:@"exps"] && [components.port integerValue] == 443) {
    components.port = nil;
  }
  
  return [components URL];
}

+ (BOOL)_isShellManifestUrl: (NSURL *)normalizedUri
{
  NSString *uriString = normalizedUri.absoluteString;
  for (NSString *shellManifestUrl in [EXShellManager sharedInstance].allManifestUrls) {
    NSURL *normalizedShellManifestURL = [self _uriNormalizedForRouting:[NSURL URLWithString:shellManifestUrl]];
    if ([normalizedShellManifestURL.absoluteString isEqualToString:uriString]) {
      return YES;
    }
  }
  return NO;
}

+ (BOOL)application:(UIApplication *)application
            openURL:(NSURL *)URL
  sourceApplication:(NSString *)sourceApplication
         annotation:(id)annotation
{
  [[NSNotificationCenter defaultCenter] postNotificationName:kEXKernelOpenUrlNotification
                                                      object:nil
                                                    userInfo:@{
                                                               @"url": URL.absoluteString
                                                               }];
  return YES;
}

+ (BOOL)application:(UIApplication *)application
continueUserActivity:(NSUserActivity *)userActivity
 restorationHandler:(void (^)(NSArray *))restorationHandler
{
  if ([userActivity.activityType isEqualToString:NSUserActivityTypeBrowsingWeb]) {
    [[NSNotificationCenter defaultCenter] postNotificationName:kEXKernelOpenUrlNotification
                                                        object:nil
                                                      userInfo:@{
                                                                 @"url": userActivity.webpageURL.absoluteString
                                                                 }];
  }
  return YES;
}

+ (NSURL *)initialUrlFromLaunchOptions:(NSDictionary *)launchOptions
{
  NSURL *initialUrl;

  if (launchOptions) {
    if (launchOptions[UIApplicationLaunchOptionsURLKey]) {
      initialUrl = launchOptions[UIApplicationLaunchOptionsURLKey];
    } else if (launchOptions[UIApplicationLaunchOptionsUserActivityDictionaryKey]) {
      NSDictionary *userActivityDictionary = launchOptions[UIApplicationLaunchOptionsUserActivityDictionaryKey];
      
      if ([userActivityDictionary[UIApplicationLaunchOptionsUserActivityTypeKey] isEqual:NSUserActivityTypeBrowsingWeb]) {
        initialUrl = ((NSUserActivity *)userActivityDictionary[@"UIApplicationLaunchOptionsUserActivityKey"]).webpageURL;
      }
    }
  }

  return initialUrl;
}

+ (NSString *)deviceInstallUUID
{
  NSString *uuid = [[NSUserDefaults standardUserDefaults] stringForKey:kEXDeviceInstallUUIDKey];
  if (!uuid) {
    uuid = [[NSUUID UUID] UUIDString];
    [[NSUserDefaults standardUserDefaults] setObject:uuid forKey:kEXDeviceInstallUUIDKey];
    [[NSUserDefaults standardUserDefaults] synchronize];
  }
  return uuid;
}

#pragma mark - Bridge stuff

- (void)dispatchKernelJSEvent:(NSString *)eventName body:(NSDictionary *)eventBody onSuccess:(void (^_Nullable)(NSDictionary * _Nullable))success onFailure:(void (^_Nullable)(NSString * _Nullable))failure
{
  EXKernelModule *kernelModule = [self _nativeModuleForBridge:_bridgeRegistry.kernelBridge named:@"ExponentKernel"];
  if (kernelModule) {
    [kernelModule dispatchJSEvent:eventName body:eventBody onSuccess:success onFailure:failure];
  }
}

- (void)_dispatchJSEvent:(NSString *)eventName body:(NSDictionary *)eventBody onBridge:(id)destinationBridge
{
  [destinationBridge enqueueJSCall:@"RCTDeviceEventEmitter.emit"
                    args:eventBody ? @[eventName, eventBody] : @[eventName]];
}

- (id)_nativeModuleForBridge:(id)destinationBridge named:(NSString *)moduleName
{
  if ([destinationBridge respondsToSelector:@selector(batchedBridge)]) {
    id batchedBridge = [destinationBridge batchedBridge];
    id moduleData = [batchedBridge moduleDataForName:moduleName];
    
    // React Native before SDK 11 didn't strip the "RCT" prefix from module names
    if (!moduleData && ![moduleName hasPrefix:@"RCT"]) {
      moduleData = [batchedBridge moduleDataForName:[@"RCT" stringByAppendingString:moduleName]];
    }
    
    if (moduleData) {
      return [moduleData instance];
    }
  } else {
    DDLogError(@"Bridge does not support the API we use to get its underlying batched bridge");
  }
  return nil;
}

- (void)_moveBridgeToForeground: (id)destinationBridge
{
  if (destinationBridge != _bridgeRegistry.kernelBridge) {
    // kernel JS needs to bring the relevant frame/bridge to visibility.
    NSURL *frameUrlToForeground = [_bridgeRegistry recordForBridge:destinationBridge].frame.initialUri;
    [self dispatchKernelJSEvent:kEXKernelShouldForegroundTaskEvent body:@{ @"taskUrl":frameUrlToForeground.absoluteString } onSuccess:nil onFailure:nil];
  }
}

/**
 *  If the bridge has a batchedBridge or parentBridge selector, posts the notification on that object as well.
 */
- (void)_postNotificationName: (NSNotificationName)name onAbstractBridge: (id)bridge
{
  [[NSNotificationCenter defaultCenter] postNotificationName:name object:bridge];
  if ([bridge respondsToSelector:@selector(batchedBridge)]) {
    [[NSNotificationCenter defaultCenter] postNotificationName:name object:[bridge batchedBridge]];
  } else if ([bridge respondsToSelector:@selector(parentBridge)]) {
    [[NSNotificationCenter defaultCenter] postNotificationName:name object:[bridge parentBridge]];
  }
}

#pragma mark - EXKernelModuleDelegate

- (void)kernelModuleDidSelectDevMenu:(__unused EXKernelModule *)module
{
  EXDevMenuViewController *vcDevMenu = [[EXDevMenuViewController alloc] init];
  if (_vcExponentRoot) {
    [_vcExponentRoot presentViewController:vcDevMenu animated:YES completion:nil];
  }
}

- (void)kernelModule:(__unused EXKernelModule *)module taskDidForegroundWithType:(NSInteger)type params:(NSDictionary *)params
{
  EXKernelRoute routetype = (EXKernelRoute)type;
  [[EXAnalytics sharedInstance] logForegroundEventForRoute:routetype fromJS:YES];
  
  if (params) {
    NSString *urlToForeground = params[@"url"];
    NSString *urlToBackground = params[@"urlToBackground"];
    id bridgeToForeground = nil;
    id bridgeToBackground = nil;
    
    if (routetype == kEXKernelRouteHome) {
      bridgeToForeground = _bridgeRegistry.kernelBridge;
    }
    if (routetype == kEXKernelRouteBrowser && !urlToBackground) {
      bridgeToBackground = _bridgeRegistry.kernelBridge;
    }

    for (id bridge in [_bridgeRegistry bridgeEnumerator]) {
      EXKernelBridgeRecord *bridgeRecord = [_bridgeRegistry recordForBridge:bridge];
      if (urlToForeground && [bridgeRecord.frame.initialUri.absoluteString isEqualToString:urlToForeground]) {
        bridgeToForeground = bridge;
      } else if (urlToBackground && [bridgeRecord.frame.initialUri.absoluteString isEqualToString:urlToBackground]) {
        bridgeToBackground = bridge;
      }
    }
    
    if (bridgeToBackground) {
      [self _postNotificationName:kEXKernelBridgeDidBackgroundNotification onAbstractBridge:bridgeToBackground];
      id appStateModule = [self _nativeModuleForBridge:bridgeToBackground named:@"AppState"];
      if ([appStateModule respondsToSelector:@selector(setState:)]) {
        [appStateModule setState:@"background"];
      }
    }
    if (bridgeToForeground) {
      [self _postNotificationName:kEXKernelBridgeDidForegroundNotification onAbstractBridge:bridgeToForeground];
      id appStateModule = [self _nativeModuleForBridge:bridgeToForeground named:@"AppState"];
      if ([appStateModule respondsToSelector:@selector(setState:)]) {
        [appStateModule setState:@"active"];
      }
      _bridgeRegistry.lastKnownForegroundBridge = bridgeToForeground;
    } else {
      _bridgeRegistry.lastKnownForegroundBridge = nil;
    }

  }
}

- (void)kernelModule:(EXKernelModule *)module didRequestManifestWithUrl:(NSURL *)url originalUrl:(NSURL *)originalUrl success:(void (^)(NSString *))success failure:(void (^)(NSError *))failure
{
  if (!([url.scheme isEqualToString:@"http"] || [url.scheme isEqualToString:@"https"])) {
    NSURLComponents *components = [NSURLComponents componentsWithURL:url resolvingAgainstBaseURL:NO];
    components.scheme = @"http";
    url = [components URL];
  }
  EXManifestResource *manifestResource = [[EXManifestResource alloc] initWithManifestUrl:url originalUrl:originalUrl];
  [manifestResource loadResourceWithBehavior:kEXCachedResourceFallBackToCache successBlock:^(NSData * _Nonnull data) {
    NSString *manifestString = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
    success(manifestString);
  } errorBlock:^(NSError * _Nonnull error) {
#if DEBUG
    if ([EXShellManager sharedInstance].isShell && error && error.code == 404) {
      NSString *message = error.localizedDescription;
      message = [NSString stringWithFormat:@"Make sure you are serving your project from XDE or exp (%@)", message];
      error = [NSError errorWithDomain:error.domain code:error.code userInfo:@{ NSLocalizedDescriptionKey: message }];
    }
#endif
    failure(error);
  }];
}

#pragma mark - App State

- (void)_handleAppStateDidChange:(NSNotification *)notification
{
  NSString *newState;
  
  if ([notification.name isEqualToString:UIApplicationWillResignActiveNotification]) {
    newState = @"inactive";
  } else if ([notification.name isEqualToString:UIApplicationWillEnterForegroundNotification]) {
    newState = @"background";
  } else {
    switch (RCTSharedApplication().applicationState) {
      case UIApplicationStateActive:
        newState = @"active";
        break;
      case UIApplicationStateBackground: {
        newState = @"background";
        break;
      }
      default: {
        newState = @"unknown";
        break;
      }
    }
  }
  
  if (_bridgeRegistry.lastKnownForegroundBridge) {
    id appStateModule = [self _nativeModuleForBridge:_bridgeRegistry.lastKnownForegroundBridge named:@"AppState"];
    NSString *lastKnownState;
    if ([appStateModule respondsToSelector:@selector(lastKnownState)]) {
      lastKnownState = [appStateModule lastKnownState];
    }
    if ([appStateModule respondsToSelector:@selector(setState:)]) {
      [appStateModule setState:newState];
    }
    if (!lastKnownState || ![newState isEqualToString:lastKnownState]) {
      if ([newState isEqualToString:@"active"]) {
        [self _postNotificationName:kEXKernelBridgeDidForegroundNotification onAbstractBridge:_bridgeRegistry.lastKnownForegroundBridge];
      } else if ([newState isEqualToString:@"background"]) {
        [self _postNotificationName:kEXKernelBridgeDidBackgroundNotification onAbstractBridge:_bridgeRegistry.lastKnownForegroundBridge];
      }
    }
  }
}

@end

NS_ASSUME_NONNULL_END
