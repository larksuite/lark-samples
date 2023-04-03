const lark = require('@larksuiteoapi/node-sdk');
const http = require('http');
const {
    APP_ID,
    APP_SECRET
} = require('./config');

if (!APP_ID || !APP_SECRET) {
    throw new Error('需在config.js中填写APP_ID和APP_SECRET');
} 

const pickRequestData = (req) =>
    new Promise((resolve) => {
        let chunks = '';
        req.on('data', (chunk) => {
            chunks += chunk;
        });

        req.on('end', () => {
            const data = JSON.parse(chunks);
            resolve(data);
        });
    });

const client = new lark.Client({
    appId: APP_ID,
    appSecret: APP_SECRET,
    appType: lark.AppType.SelfBuild,
});

const server = http.createServer(async (req, res) => {
    const data = (await pickRequestData(req));

    if (data.type === 'url_verification') {
        res.end(
            JSON.stringify({
                challenge: data.challenge,
            })
        );
    }
});

const eventDispatcher = new lark.EventDispatcher({}).register({
    'im.message.receive_v1': async (data) => {
        const open_chat_id = data.message.chat_id;
        const msg = JSON.parse(data.message.content).text;

        const res = await client.im.message.create({
            params: {
                receive_id_type: 'chat_id',
            },
            data: {
                receive_id: open_chat_id,
                content: JSON.stringify({text: `hello ${msg}`}),
                msg_type: 'text',
            },
        });

        return res;
    }
});

server.on('request', lark.adaptDefault('/webhook/event', eventDispatcher)).listen(3000);