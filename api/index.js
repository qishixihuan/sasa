export const config = {
  runtime: 'edge', // 启用 Edge 边缘节点，速度更快，语法和 Cloudflare Worker 几乎一样
};

export default async function handler(request) {
  const url = new URL(request.url);
  const ACTUAL_DOMAIN = 'sunlea.de'; // 你的目标公益站

  // 1. 处理 CORS 跨域预检
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-requested-with',
      },
    });
  }

  // 2. 自动修正路径
  let path = url.pathname;
  // Vercel 默认的路由会带上 /api，我们需要把它去掉，替换成 /v1
  if (path.startsWith('/api')) {
    path = path.replace('/api', '/v1');
  } else if (!path.startsWith('/v1') && path !== '/') {
    path = '/v1' + path;
  }
  
  const targetUrl = `https://${ACTUAL_DOMAIN}${path}${url.search}`;

  // 3. 重构请求头，防止触发 WAF
  const newHeaders = new Headers(request.headers);
  newHeaders.set('Host', ACTUAL_DOMAIN);
  newHeaders.delete('Origin');
  newHeaders.delete('Referer');
  // 伪装成常见的 API 请求端
  newHeaders.set('User-Agent', 'OpenAI/v1 PythonBindings/0.28.1');

  const modifiedRequest = new Request(targetUrl, {
    method: request.method,
    headers: newHeaders,
    body: request.body,
    redirect: 'follow',
  });

  try {
    const response = await fetch(modifiedRequest);
    const responseHeaders = new Headers(response.headers);
    responseHeaders.set('Access-Control-Allow-Origin', '*');

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: "Vercel 代理请求失败", details: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
}
