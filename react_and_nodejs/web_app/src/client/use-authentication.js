import { useState, useEffect } from 'react';
import logo from '../logo.svg';

const useAuthentication = () => {
    const [userInfo, setUserInfo] = useState({
        avatar: logo,
        name: 'react app'
    });
    
    const init = async () => {
        const {
            appid,
            noncestr,
            signature,
            timestamp
        } = await fetch(`/get_config_parameters?url=${encodeURI(document.location.href.split('#')[0])}`).then(res => res.json());

        await window.h5sdk.config({
            appId: appid,
            timestamp: timestamp,
            nonceStr: noncestr,
            signature: signature,
            //鉴权成功回调
            onSuccess: (res) => {
                console.log(`config success: ${JSON.stringify(res)}`);
            },
            //鉴权失败回调
            onFail: (err) => {
                throw(`config failed: ${JSON.stringify(err)}`);
            }
        });

        window.h5sdk.ready(async () => {
            await window.tt.getUserInfo({
                // getUserInfo API 调用成功回调
                success(res) {
                const { avatarUrl, nickName } = res.userInfo;
                // 将用户信息展示在前端页面上
                setUserInfo({
                    avatar: avatarUrl,
                    name: nickName
                });
                },
                // getUserInfo API 调用失败回调
                fail(err) {
                    console.log(`getUserInfo failed, err:`, JSON.stringify(err));
                }
            });
            // 调用 showToast API 弹出全局提示框，详细文档参见https://open.feishu.cn/document/uAjLw4CM/uYjL24iN/block/api/showtoast
            await window.tt.showToast({
                title: '鉴权成功',
                icon: 'success',
                duration: 3000,
                success (res) {
                console.log('showToast 调用成功', res.errMsg);
                },
                fail (res) {
                console.log('showToast 调用失败', res.errMsg);
                },
                complete (res) {
                console.log('showToast 调用结束', res.errMsg);
                }
            }); 
        });
    }
    
    useEffect(() => {
        init();
    }, []);

    return { userInfo }
}

export default useAuthentication;