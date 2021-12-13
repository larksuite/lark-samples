const lang = window.navigator.language;

$('document').ready(apiAuth())

function apiAuth() {
    if (!window.h5sdk) {
        console.log('invalid h5sdk')
        alert('please open in feishu')
        return
    }

    const url = encodeURI(window.location.href)
    fetch(`/get_signature?url=${url}`).then(response => response.json().then(res => {
        window.h5sdk.config({
            appId: res.appid,
            timestamp: res.timestamp,
            nonceStr: res.noncestr,
            signature: res.signature,
            jsApiList: [],
            onSuccess: (res) => {
                console.log(`config success: ${JSON.stringify(res)}`);
            },
            onFail: (err) => {
                throw(`config failed: ${JSON.stringify(err)}`);
            }
        });
        window.h5sdk.error(err => {
            throw('h5sdk error:', JSON.stringify(err));
        });
        window.h5sdk.ready(() => {
                // the interface needs to be called after authentication, others can be called directly
                tt.getUserInfo({
                    success(res) {
                        console.log("getUserInfo succeed")
                        showUser(res.userInfo)
                    },
                    fail(err) {
                        console.log(`getUserInfo failed, err:`, JSON.stringify(err));
                    }
                });
            }
        )
    })).catch(function (e) {
        console.error(e)
    })
}

function showUser(res) {
    // 展示用户信息
    $('#img_div').html(`<img src="${res.avatarUrl}" width="100%" height=""100%/>`)
    $('#hello_text_name').text(lang === "zh-CN" ? `${res.nickName}` : `${res.i18nName.en_us}`);
    $('#hello_text_welcome').text(lang === "zh-CN" ? "欢迎使用飞书" : "welcome to Feishu");
}
