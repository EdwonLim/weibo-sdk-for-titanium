var Tag = 'WeiboSDK-';

var Storage = Titanium.App.Properties;

var Timeout = 5000;

var Util = {
    bindParam : function(obj, isEncode) {
        var queryParams = [];
        for (var key in obj) {
            if (obj[key] != undefined) {
                queryParams.push(key + '=' + (isEncode ? encodeURIComponent(obj[key].toString()) : obj[key].toString()));
            }
        }
        return queryParams.join('&');
    },
    getHttpResponse : function(url, type, callback) {
        if (url && type && callback && typeof callback == 'function') {
            var client = Ti.Network.createHTTPClient({
                onload : function() {
                    var info = {}, isError = false;
                    try {
                        info = JSON.parse(this.responseText);
                    } catch(e) {
                        isError = true;
                        info = {
                            message : e.error
                        };
                    }
                    callback(info, isError);
                },
                onerror : function(e) {
                    callback({
                        message : e.error
                    }, true);
                },
                timeout : Timeout
            });
            client.open(type.toString(), url.toString());
            client.send();
        }
    },
    Storage : {
        has : function(key) {
            return Storage.hasProperty(key);
        },
        load : function(key) {
            return Storage.getObject(key);
        },
        save : function(key, tokenObj) {
            Storage.setObject(key, tokenObj);
        },
        clear : function(key) {
            Storage.removeProperty(key);
        },
        getKey : function(key) {
            return Tag + key;
        }
    },
    OAuth : {
        authorizeURL : 'https://open.weibo.cn/oauth2/authorize',
        tokenURL : 'https://open.weibo.cn/oauth2/access_token',
        apiURL : 'https://api.weibo.com/2/',
        getCode : function(param, callback, isForce) {
            if (param && param.client_id && param.redirect_uri) {
                param.response_type = 'code';
                param.display = 'mobile';
                isForce && (param.forcelogin = 'true');
                var url = Util.OAuth.authorizeURL + '?' + Util.bindParam(param, false);
                var win = Ti.UI.createWindow();
                var webView = Ti.UI.createWebView({
                    url : url,
                    width : Ti.Platform.displayCaps.platformWidth,
                    height : Ti.Platform.displayCaps.platformHeight
                });
                webView.addEventListener('load', function() {
                    if (webView.getUrl().indexOf(param.redirect_uri) == 0) {
                        var params = webView.getUrl().match(new RegExp('code=\\w+'));
                        if (params.length && params[0].split('=').length > 1) {
                            callback && callback(params[0].split('=')[1]);
                        } else {
                            callback && callback(null, true);
                        }
                        win.close();
                    }
                });
                win.add(webView);
                win.open();
            } else {
                callback && callback(null, true);
            }
        },
        getToken : function(param, callback) {
            if (param && param.client_id && param.redirect_uri && param.client_secret) {
                param.grant_type = 'authorization_code';
                var url = Util.OAuth.tokenURL + '?' + Util.bindParam(param, false);
                Util.getHttpResponse(url, 'POST', callback);
            }
        },
        getData : function(api, param, callback, config) {
            var sendType = config.isPost ? 'POST' : 'GET',
                isEncode = !!config.isEncode,
                url = Util.OAuth.apiURL + api + '.json?' + Util.bindParam(param, isEncode);
            Util.getHttpResponse(url, sendType, callback);
        }
    }
};

var SDK = function(appKey, appSecret, redirectUri) {
    this.appKey = appKey;
    this.appSecret = appSecret;
    this.redirectUri = redirectUri;
    this.loginInfo = {
        access_token : null
    };
    this.init();
};

SDK.prototype = {
    init : function() {
        var key = Util.Storage.getKey(this.appKey);
        if (Util.Storage.has(key)) {
            this.loginInfo = Util.Storage.load(key);
        }
    },
    hasToken : function() {
        return !!this.loginInfo.access_token;
    },
    getToken : function(callback, isForce) {
        var me = this;
        if (typeof callback == 'function') {
            Util.OAuth.getCode({
                client_id : me.appKey,
                redirect_uri : me.redirectUri
            }, function(code, isError) {
                if (!isError) {
                    Util.OAuth.getToken({
                        client_id : me.appKey,
                        redirect_uri : me.redirectUri,
                        client_secret : me.appSecret,
                        code : code
                    }, function(info, isError){
                        if (!isError) {
                            info.start_time = new Date().getTime();
                            me.loginInfo = info;
                            Util.Storage.save(Util.Storage.getKey(me.appKey), info);
                            callback && callback({
                                status : 'Success'
                            });
                        } else {
                            Util.Storage.clear(Util.Storage.getKey(me.appKey));
                            callback && callback({
                                error : true,
                                message : 'Get Token Error.'
                            });
                        }
                    });
                } else {
                    callback && callback({
                        error : true,
                        message : 'Login Error.'
                    })
                }
            }, !!isForce);
        }
    },
    oAuth : function(callback) {
        this.getToken(callback, false);
    },
    reOAuth : function(callback) {
        Util.Storage.clear(Util.Storage.getKey(this.appKey));
        this.getToken(callback, true);
    },
    getData : function(api, param, callback, config) {
        if (callback && typeof callback == 'function') {
            config = config || {};
            config.isPost = !!config.isPost;
            config.isEncode = !!config.isEncode;
            param = param || {};
            param.access_token = this.loginInfo.access_token;
            Util.OAuth.getData(api, param, callback, config);
        }
    }
};

module.exports.init = function(appKey, appSecret, redirectUri){
    var sdk = new SDK(appKey, appSecret, redirectUri);
    return sdk;
};