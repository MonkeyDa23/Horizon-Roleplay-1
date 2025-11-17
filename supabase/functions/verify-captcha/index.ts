// supabase/functions/verify-captcha/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

// FIX: Declare 'Deno' to inform TypeScript of its existence in the Supabase Edge Function environment.
declare const Deno: any;

// FIX: Cast Deno to 'any' to resolve TypeScript error about missing 'env' property.
// This can happen in environments where Deno types are not automatically recognized.
const HCAPTCHA_SECRET_KEY = (Deno as any).env.get('HCAPTCHA_SECRET_KEY')

serve(async (req) => {
  // This is needed if you're planning to invoke your function from a browser.
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      } 
    })
  }

  try {
    if (!HCAPTCHA_SECRET_KEY) {
      throw new Error('HCAPTCHA_SECRET_KEY is not set in Supabase secrets.');
    }

    const { token } = await req.json();
    if (!token) {
      return new Response(JSON.stringify({ error: 'Captcha token is required.' }), {
        status: 400,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        },
      });
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
      return new Response(JSON.stringify({ success: true, message: 'Captcha verified.' }), {
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        },
      });
    } else {
      console.warn('[HCAPTCHA] Verification failed:', data['error-codes']);
      return new Response(JSON.stringify({ success: false, error: 'Captcha verification failed.', details: data['error-codes'] }), {
        status: 400,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        },
      });
    }
  } catch (error) {
    console.error('[HCAPTCHA Function] Error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }
})