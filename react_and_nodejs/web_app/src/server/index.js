const lark = require('@larksuiteoapi/node-sdk');
const express = require('express');
const crypto = require('crypto');
const {
    APP_ID,
    APP_SECRET
} = require('../config');

if (!APP_ID || !APP_SECRET) {
    throw new Error('需在config.js中填写APP_ID和APP_SECRET');
} 

// 随机字符串，用于签名生成加密使用
const NONCE_STR = "13oEviLbrTo458A3NjrOwS70oTOXVOAm";

const client = new lark.Client({
    appId: APP_ID,
    appSecret: APP_SECRET,
});

const getConfigParameters = async (url) => {
    const {
        data: { 
            ticket
        }
    } = await client.request({
        url: '/open-apis/jssdk/ticket/get',
        method: 'GET',
    });

    const timestamp = Date.now();
    const signature = (
            crypto
                .createHash('sha1')
                .update(`jsapi_ticket=${ticket}&noncestr=${NONCE_STR}&timestamp=${timestamp}&url=${url}`)
                .digest('hex')
    );

    return {
        "appid": APP_ID,
        "ticket": ticket,
        "signature": signature,
        "noncestr": NONCE_STR,
        "timestamp": timestamp,
    }
}

const getLoginInfo = async (code) => {
    const {
        app_access_token
    } = await client.request({
        url: '/open-apis/auth/v3/app_access_token/internal',
        method: 'GET',
        params: {
            app_id: APP_ID,
            app_secret: APP_SECRET
        }
    });

    // 线上建议将token缓存起来，避免多次请求
    const {
        data: { 
            access_token 
        }
    } = await client.request({
        url: '/open-apis/authen/v1/access_token',
        method: 'POST',
        data: {
            grant_type: 'authorization_code',
            code
        }
    }, {
        headers: {
            Authorization: `Bearer ${app_access_token}`
        }
    });

    const {
        data
    } = await client.request({
        url: '/open-apis/authen/v1/user_info',
        method: 'GET',
    }, lark.withUserAccessToken(access_token));

    return data;
}

const app = express();
app.get('/get_config_parameters', async (req, res) => {
    const result = await getConfigParameters(req.query.url);
    res.json(result);
});
app.get('/get_user_info', async (req, res) => {
    const result = await getLoginInfo(req.query.code);
    res.json(result);
});
app.get('/get_app_id', async (_, res) => {
    res.end(APP_ID);
});

app.listen(3001);