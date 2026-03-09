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

  // 2. 路径处理
  let path = url.pathname;
  if (path.startsWith('/api')) path = path.slice(4);
  if (!path) path = '/';
  if (!path.startsWith('/v1') && path !== '/') path = '/v1' + path;

  // ==========================================
  // 🌟 魔法一：伪造模型列表 🌟
  // 拦截 Tavo 的获取列表请求，直接返回假数据，让它乖乖加载 UI
  if (request.method === 'GET' && path === '/v1/models') {
    return new Response(JSON.stringify({
      "object": "list",
      "data": [
        { "id": "gpt-3.5-turbo", "object": "model", "created": 1677610602, "owned_by": "openai" },
        { "id": "gpt-4o", "object": "model", "created": 1715367049, "owned_by": "openai" },
        { "id": "claude-3-5-sonnet", "object": "model", "created": 1718841600, "owned_by": "anthropic" }
      ]
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
  // ==========================================

  const targetUrl = `https://${ACTUAL_DOMAIN}${path}${url.search}`;
  const newHeaders = new Headers(request.headers);
  newHeaders.set('Host', ACTUAL_DOMAIN);
  newHeaders.delete('Origin');
  newHeaders.delete('Referer');
  newHeaders.set('User-Agent', 'OpenAI/v1 PythonBindings/0.28.1');

  // ==========================================
  // 🌟 魔法二：强制篡改对话模型 🌟
  let modifiedBody = request.body;
  if (request.method === 'POST' && path === '/v1/chat/completions') {
    try {
      const clonedRequest = request.clone();
      const bodyJson = await clonedRequest.json();

      // 【极其重要】把下面引号里的 gpt-3.5-turbo 
      // 换成你在 Chatbox 里测试成功的那个具体模型名字！
      bodyJson.model = 'gpt-3.5-turbo';

      modifiedBody = JSON.stringify(bodyJson);
    } catch (e) {
      // 解析失败不影响正常转发
    }
  }
  // ==========================================

  const requestInit = {
    method: request.method,
    headers: newHeaders,
    redirect: 'follow',
  };

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    requestInit.body = modifiedBody;
  }

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
