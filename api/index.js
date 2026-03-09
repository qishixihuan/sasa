export const config = {
  runtime: 'edge', 
};

export default async function handler(request) {
  const url = new URL(request.url);
  const ACTUAL_DOMAIN = 'sunlea.de'; 

  // 1. CORS 跨域放行
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

  // 2. 精准路径修正（适配 /models 和 /chat/completions）
  let path = url.pathname;
  if (path.startsWith('/api')) {
    path = path.slice(4); // 干净地切掉 /api
  }
  if (!path) path = '/';
  
  if (!path.startsWith('/v1') && path !== '/') {
    path = '/v1' + path;
  }
  
  const targetUrl = `https://${ACTUAL_DOMAIN}${path}${url.search}`;

  // 3. 重构请求头
  const newHeaders = new Headers(request.headers);
  newHeaders.set('Host', ACTUAL_DOMAIN);
  newHeaders.delete('Origin');
  newHeaders.delete('Referer');
  newHeaders.set('User-Agent', 'OpenAI/v1 PythonBindings/0.28.1');

  // 【选填】如果你之前把 API Key 写死在这里了，可以保留下面这行：
  // newHeaders.set('Authorization', 'Bearer sk-xxxxxx'); 

  // 4. 【核心修复】安全构建请求参数，严防 GET 请求带 body
  const requestInit = {
    method: request.method,
    headers: newHeaders,
    redirect: 'follow',
  };
  
  // 只有非 GET 和 HEAD 请求（比如发消息的 POST），才允许带 body
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    requestInit.body = request.body;
  }

  // 5. 转发并返回
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
