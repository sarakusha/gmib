import crypto from 'node:crypto';

const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

const nonce = (): string =>
    [...new Array(32)].map(() => characters[Math.floor(Math.random() * characters.length)]).join('');

const apiToken = process.env.PRI_API_TOKEN!;
const apiSecret = process.env.PRI_API_SECRET!;
const baseUrl = process.env.PRI_BASE_URL!;

type Props = {
    path: string;
    method?: string;
    query?: string;
    data?: any;
};

const authFetch = async ({ path, method = 'GET', query, data }: Props) => {
    let authNonce = nonce();
    let authTimeStamp = Math.floor(Date.now() / 1000);
    let authString = [apiToken, authTimeStamp, authNonce, method.toUpperCase(), path].join('&');
    let url = `${baseUrl}${path}${query ? new URLSearchParams(query) : ''}`;

    const res = await fetch(url, {
        method: method,
        headers: {
            'Auth-Token': apiToken,
            'Auth-Timestamp': authTimeStamp.toString(),
            'Auth-Nonce': authNonce,
            'Auth-Signature': crypto
                .createHmac('sha256', apiSecret!)
                .update(authString)
                .digest('base64'),
            ...(data && { 'Content-Type': 'application/json' }),
        },
        body: data && JSON.stringify(data),
    });
    return res.ok ? res.json() : undefined;
};
