export const config = {
  runtime: 'edge', 
};

export default async function handler(request) {
  const url = new URL(request.url);
  const ACTUAL_DOMAIN = 'sunlea.de'; 

  // 1. CORS 放行
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': '*',
        'Access-Control-Allow-Headers': '*', 
      },
    });
  }

  // 2. 路径处理（完美适配有无 /api 和 /v1 的情况）
  let path = url.pathname;
  if (path.startsWith('/api')) path = path.slice(4);
  if (!path) path = '/';
  if (!path.startsWith('/v1') && path !== '/') path = '/v1' + path;

  const targetUrl = `https://${ACTUAL_DOMAIN}${path}${url.search}`;

  // 3. 重构请求头，伪装身份防拦截
  const newHeaders = new Headers(request.headers);
  newHeaders.set('Host', ACTUAL_DOMAIN);
  newHeaders.delete('Origin');
  newHeaders.delete('Referer');
  newHeaders.set('User-Agent', 'OpenAI/v1 PythonBindings/0.28.1');

  // 4. 组装最终请求（严格限制 GET 请求不带 body）
  const requestInit = {
    method: request.method,
    headers: newHeaders,
    redirect: 'follow',
  };

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    requestInit.body = request.body; // 恢复原样透传，不再篡改你的对话内容和模型
  }

  // 5. 转发并返回真实数据
  try {
    const response = await fetch(targetUrl, requestInit);
    const responseHeaders = new Headers(response.headers);
    responseHeaders.set('Access-Control-Allow-Origin', '*');

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: "Vercel Proxy Error", details: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
}
