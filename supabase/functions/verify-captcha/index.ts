// supabase/functions/verify-captcha/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

declare const Deno: any;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    const HCAPTCHA_SECRET_KEY = Deno.env.get('HCAPTCHA_SECRET_KEY');
    if (!HCAPTCHA_SECRET_KEY) {
      console.error('[HCAPTCHA Function] Error: HCAPTCHA_SECRET_KEY is not set in Supabase secrets.');
      // Return a 200 with an error payload for easier client-side handling
      return new Response(
        JSON.stringify({ success: false, error: 'Captcha service is not configured on the server. The HCaptcha secret key is missing.' }),
        { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    const { token } = await req.json();
    if (!token) {
      return new Response(
        JSON.stringify({ success: false, error: 'Captcha token is required.' }),
        { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    const params = new URLSearchParams();
    params.append('response', token);
    params.append('secret', HCAPTCHA_SECRET_KEY);

    const response = await fetch('https://api.hcaptcha.com/siteverify', {
      method: 'POST',
      body: params,
    });

    const data = await response.json();

    if (data.success) {
      return new Response(
        JSON.stringify({ success: true, message: 'Captcha verified.' }),
        { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    } else {
      console.warn('[HCAPTCHA] Verification failed:', data['error-codes']);
      return new Response(
        JSON.stringify({ success: false, error: 'Captcha verification failed.', details: data['error-codes'] }),
        { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('[HCAPTCHA Function] Uncaught Error:', error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }
})
