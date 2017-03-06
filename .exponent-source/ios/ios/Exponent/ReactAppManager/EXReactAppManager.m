// Copyright 2015-present 650 Industries. All rights reserved.

#import "EXFatalHandler.h"
#import "EXFrame.h"
#import "EXJavaScriptResource.h"
#import "EXKernel.h"
#import "EXKernelUtil.h"
#import "EXReactAppManager+Private.h"
#import "EXShellManager.h"
#import "EXVersionManager.h"
#import "EXVersions.h"

#import <React/RCTBridge.h>
#import <React/RCTDevLoadingView.h>
#import <React/RCTRootView.h>

NSTimeInterval const kEXJavaScriptResourceLongerTimeout = 120;

@interface EXReactAppManager ()

@property (nonnull, strong) EXJavaScriptResource *jsResource;

@end

@implementation EXReactAppManager

- (void)reload
{
  EXAssertMainThread();
  NSAssert((_delegate != nil), @"Cannot init react app without EXReactAppManagerDelegate");
  [self invalidate];
  [self computeVersionSymbolPrefix];
  [RCTDevLoadingView setEnabled:NO];
  
  if ([self isReadyToLoad]) {
    Class versionManagerClass = [self versionedClassFromString:@"EXVersionManager"];
    Class bridgeClass = [self versionedClassFromString:@"RCTBridge"];
    Class rootViewClass = [self versionedClassFromString:@"RCTRootView"];
    
    _versionManager = [[versionManagerClass alloc]
                       initWithFatalHandler:handleFatalReactError
                       logFunction:[self logFunction]
                       logThreshold:[self logLevel]
                       ];
    _reactBridge = [[bridgeClass alloc] initWithDelegate:self launchOptions:[self launchOptionsForBridge]];
    _reactRootView = [[rootViewClass alloc] initWithBridge:_reactBridge
                                                moduleName:[self applicationKeyForRootView]
                                         initialProperties:[self initialPropertiesForRootView]];

    [_delegate reactAppManagerDidInitApp:self];
    
    NSAssert([_reactBridge isLoading], @"React bridge should be loading once initialized");
    [self registerBridge];
    [self _startObservingBridgeNotifications];
    [_versionManager bridgeWillStartLoading:_reactBridge];
  }
}

- (void)invalidate
{
  [self _stopObservingBridgeNotifications];
  if (_versionManager) {
    [_versionManager invalidate];
    _versionManager = nil;
  }
  if (_reactRootView) {
    [_reactRootView removeFromSuperview];
    _reactRootView = nil;
  }
  if (_reactBridge) {
    [[EXKernel sharedInstance].bridgeRegistry setError:nil forBridge:_reactBridge];
    [self unregisterBridge];
    [_reactBridge invalidate];
    _reactBridge = nil;
    if (_delegate) {
      [_delegate reactAppManagerDidDestroyApp:self];
    }
  }
  [self _invalidateVersionState];
  _jsResource = nil;
}


#pragma mark - RCTBridgeDelegate

- (void)loadSourceForBridge:(RCTBridge *)bridge withBlock:(RCTSourceLoadBlock)loadCallback
{
  // clear any potentially old loading state
  [[EXKernel sharedInstance].bridgeRegistry setError:nil forBridge:_reactBridge];

  _jsResource = [[EXJavaScriptResource alloc] initWithBundleName:[self bundleNameForJSResource] remoteUrl:bridge.bundleURL];
  _jsResource.abiVersion = _validatedVersion;
  
  __weak typeof(self) weakSelf = self;
  EXCachedResourceBehavior cacheBehavior = [self cacheBehaviorForJSResource];
  if (cacheBehavior == kEXCachedResourceNoCache) {
    // no cache - wait longer before timing out
    _jsResource.requestTimeoutInterval = kEXJavaScriptResourceLongerTimeout;
  }
  [_jsResource loadResourceWithBehavior:cacheBehavior successBlock:^(NSData * _Nonnull sourceData) {
    loadCallback(nil, sourceData, sourceData.length);
  } errorBlock:^(NSError * _Nonnull error) {
    __strong typeof(self) strongSelf = weakSelf;
    if (strongSelf) {
      [strongSelf.delegate reactAppManager:strongSelf failedToDownloadBundleWithError:error];

      // RN is going to call RCTFatal() on this error, so keep a reference to it for later
      // so we can distinguish this non-fatal error from actual fatal cases.
      [[EXKernel sharedInstance].bridgeRegistry setError:error forBridge:strongSelf.reactBridge];
      
      // react won't post this for us
      [[NSNotificationCenter defaultCenter] postNotificationName:[strongSelf _versionedString:RCTJavaScriptDidFailToLoadNotification] object:error];
    }
    loadCallback(error, nil, 0);
  }];
}

#pragma mark - JavaScript loading

- (void)_startObservingBridgeNotifications
{
  NSAssert(_reactBridge, @"Must subscribe to loading notifs for a non-null bridge");
  
  [[NSNotificationCenter defaultCenter] addObserver:self
                                           selector:@selector(_handleJavaScriptStartLoadingEvent:)
                                               name:[self _versionedString:RCTJavaScriptWillStartLoadingNotification]
                                             object:_reactBridge];
  [[NSNotificationCenter defaultCenter] addObserver:self
                                           selector:@selector(_handleJavaScriptLoadEvent:)
                                               name:[self _versionedString:RCTJavaScriptDidLoadNotification]
                                             object:_reactBridge];
  [[NSNotificationCenter defaultCenter] addObserver:self
                                           selector:@selector(_handleJavaScriptLoadEvent:)
                                               name:[self _versionedString:RCTJavaScriptDidFailToLoadNotification]
                                             object:_reactBridge];
  [[NSNotificationCenter defaultCenter] addObserver:self
                                           selector:@selector(_handleBridgeForegroundEvent:)
                                               name:kEXKernelBridgeDidForegroundNotification
                                             object:_reactBridge];
  [[NSNotificationCenter defaultCenter] addObserver:self
                                           selector:@selector(_handleBridgeBackgroundEvent:)
                                               name:kEXKernelBridgeDidBackgroundNotification
                                             object:_reactBridge];
}

- (void)_stopObservingBridgeNotifications
{
  [[NSNotificationCenter defaultCenter] removeObserver:self name:[self _versionedString:RCTJavaScriptWillStartLoadingNotification] object:_reactBridge];
  [[NSNotificationCenter defaultCenter] removeObserver:self name:[self _versionedString:RCTJavaScriptDidLoadNotification] object:_reactBridge];
  [[NSNotificationCenter defaultCenter] removeObserver:self name:[self _versionedString:RCTJavaScriptDidFailToLoadNotification] object:_reactBridge];
  [[NSNotificationCenter defaultCenter] removeObserver:self name:kEXKernelBridgeDidForegroundNotification object:_reactBridge];
  [[NSNotificationCenter defaultCenter] removeObserver:self name:kEXKernelBridgeDidBackgroundNotification object:_reactBridge];
}

- (void)_handleJavaScriptStartLoadingEvent:(NSNotification *)notification
{
  __weak typeof(self) weakSelf = self;
  dispatch_async(dispatch_get_main_queue(), ^{
    __strong typeof(self) strongSelf = weakSelf;
    if (strongSelf) {
      [strongSelf.delegate reactAppManagerStartedLoadingJavaScript:strongSelf];
    }
  });
}

- (void)_handleJavaScriptLoadEvent:(NSNotification *)notification
{
  __weak typeof(self) weakSelf = self;
  if ([notification.name isEqualToString:[self _versionedString:RCTJavaScriptDidLoadNotification]]) {
    [_versionManager bridgeFinishedLoading];
    [self _handleBridgeForegroundEvent:nil];
    dispatch_async(dispatch_get_main_queue(), ^{
      __strong typeof(self) strongSelf = weakSelf;
      if (strongSelf) {
        [strongSelf.delegate reactAppManagerFinishedLoadingJavaScript:strongSelf];
      }
    });
  } else if ([notification.name isEqualToString:[self _versionedString:RCTJavaScriptDidFailToLoadNotification]]) {
    NSError *error = (notification.userInfo) ? notification.userInfo[@"error"] : nil;
    dispatch_async(dispatch_get_main_queue(), ^{
      __strong typeof(self) strongSelf = weakSelf;
      if (strongSelf) {
        [strongSelf.delegate reactAppManager:strongSelf failedToLoadJavaScriptWithError:error];
      }
    });
  }
}

- (void)_handleBridgeForegroundEvent:(NSNotification * _Nullable)notification
{
  if ([_delegate respondsToSelector:@selector(reactAppManagerDidForeground:)]) {
    [_delegate reactAppManagerDidForeground:self];
  }
  [_versionManager bridgeDidForeground];
}

- (void)_handleBridgeBackgroundEvent:(NSNotification *)notification
{
  if ([_delegate respondsToSelector:@selector(reactAppManagerDidBackground:)]) {
    [_delegate reactAppManagerDidBackground:self];
  }
  [_versionManager bridgeDidBackground];
}

#pragma mark - internal

- (void)_invalidateVersionState
{
  _versionSymbolPrefix = @"";
  _validatedVersion = nil;
}

- (Class)versionedClassFromString: (NSString *)classString
{
  return NSClassFromString([self _versionedString:classString]);
}

- (NSString *)_versionedString: (NSString *)string
{
  return [EXVersions versionedString:string withPrefix:_versionSymbolPrefix];
}

#pragma mark - abstract stubs

#define EX_APP_MANAGER_ABSTRACT(method) \
method \
{ \
@throw [NSException exceptionWithName:NSInternalInconsistencyException \
                               reason:[NSString stringWithFormat:@"Do not call %@ directly, use a subclass", NSStringFromSelector(_cmd)] \
                             userInfo:nil]; \
}

EX_APP_MANAGER_ABSTRACT(- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge)
EX_APP_MANAGER_ABSTRACT(- (BOOL)isReadyToLoad)
EX_APP_MANAGER_ABSTRACT(- (void)computeVersionSymbolPrefix)
EX_APP_MANAGER_ABSTRACT(- (NSString *)bundleNameForJSResource)
EX_APP_MANAGER_ABSTRACT(- (EXCachedResourceBehavior)cacheBehaviorForJSResource)
EX_APP_MANAGER_ABSTRACT(- (NSURL *)bundleUrlForBridge)
EX_APP_MANAGER_ABSTRACT(- (NSDictionary * _Nullable)launchOptionsForBridge)
EX_APP_MANAGER_ABSTRACT(- (NSDictionary * _Nullable)initialPropertiesForRootView)
EX_APP_MANAGER_ABSTRACT(- (NSString *)applicationKeyForRootView)
EX_APP_MANAGER_ABSTRACT(- (RCTLogFunction)logFunction)
EX_APP_MANAGER_ABSTRACT(- (RCTLogLevel)logLevel)
EX_APP_MANAGER_ABSTRACT(- (void)registerBridge)
EX_APP_MANAGER_ABSTRACT(- (void)unregisterBridge)

@end
