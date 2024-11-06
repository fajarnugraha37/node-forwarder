import * as http from 'node:http';

export const sendInternalServerError = (
    e: unknown, 
    response: http.ServerResponse<http.IncomingMessage>, 
    originHeaders = {},
) => {
    return sendJsonResponse({
        response,
        payload: {
            message: 'Internal Server Error'
        },
        statusCode: 500,
        headers: originHeaders,
    })
}

export const sendJsonResponse = (opts: { 
    statusCode: number, 
    response: http.ServerResponse<http.IncomingMessage>, 
    payload: Record<string, any>, 
    headers?: Record<string, string | string[]>,
}) => {
    opts.response.writeHead(opts.statusCode, {
        ...(opts.headers || {}),
        ...baseResponseHeaders,
        ...jsonHeaders,
    });

    return opts.response.end(JSON.stringify({
        statusCode: opts.statusCode,
        ...opts.payload,
    }));
}

export const requestToBody = (
    request: http.IncomingMessage
) => {
    return new Promise<Buffer>((resolve, reject) => {
        const body: Buffer[] = [];
        request.on('data', chunk => body.push(chunk));
        request.on('end', () => resolve(Buffer.concat(body)));
        request.on("error", reject);
    });
}


export const securityHeaders: Record<string, string> = {
    'X-Content-Type-Options': 'nosniff',                                // Prevent MIME sniffing
    'X-Frame-Options': 'DENY',                                          // Prevent clickjacking
    'X-XSS-Protection': '1; mode=block',                                // Enable XSS protection
    'Content-Security-Policy': "default-src 'self'",                    // Basic CSP
    'Referrer-Policy': 'no-referrer',                                   // No referrer in headers
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains', // HSTS
};

export const jsonHeaders: Record<string, string> = {
    'content-type': 'application/json; charset=utf-8',
};

export const baseResponseHeaders: Record<string, string> = {
    'cache-control': 'no-cache, no-store, must-revalidate',
    ...securityHeaders,
};