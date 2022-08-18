import { useState, useEffect } from 'react';
import logo from '../logo.svg';

const useFreeLogin = () => {
    const [userInfo, setUserInfo] = useState({
        avatar: logo,
        name: 'react app'
    });

    const init = async () => {
        const appId = await fetch('/get_app_id').then(res => res.text());
        // 通过error接口处理API验证失败后的回调
        window.h5sdk.error(err => {
            throw('h5sdk error:', JSON.stringify(err));
        });

        // 通过ready接口确认环境准备就绪后才能调用API
        window.h5sdk.ready(() => {
            console.log("window.h5sdk.ready");
            console.log("url:", window.location.href);
            // 调用JSAPI tt.requestAuthCode 获取 authorization code
            window.tt.requestAuthCode({
                appId,
                // 获取成功后的回调
                async success(res) {
                    console.log("getAuthCode succeed");
                    //authorization code 存储在 res.code
                    // 此处通过fetch把code传递给接入方服务端Route: callback，并获得user_info
                    // 服务端Route: callback的具体内容请参阅服务端模块server.py的callback()函数
                    const useInfo = await fetch(`/get_user_info?code=${res.code}`).then(res => res.json());
                    setUserInfo({
                        avatar: useInfo.avatar_url,
                        name: useInfo.name
                    });
                },
                // 获取失败后的回调
                fail(err) {
                    console.log(`getAuthCode failed, err:`, JSON.stringify(err));
                }
            })
        })
    }

    useEffect(() => {
        init();
    }, []);

    return { userInfo }
}

export default useFreeLogin;