// supabase/functions/test-notification/index.ts
// @deno-types="https://esm.sh/@supabase/functions-js@2"
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const createResponse = (data: unknown, status = 200) => new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status });

async function forwardToBot(endpointPath: string, body: any) {
  // @ts-ignore
  const botUrl = Deno.env.get('VITE_DISCORD_BOT_URL');
  // @ts-ignore
  const apiKey = Deno.env.get('VITE_DISCORD_BOT_API_KEY');
  if (!botUrl || !apiKey) throw new Error("Bot integration secrets are not configured.");
  
  const endpoint = new URL(endpointPath, botUrl);
  const botResponse = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });

  const responseData = await botResponse.json().catch(() => ({}));
  if (!botResponse.ok) throw new Error(`Bot API failed with status ${botResponse.status}: ${responseData.error || responseData.details || 'No details from bot.'}`);
  return responseData;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { data: { user } } = await createClient(
        // @ts-ignore
        Deno.env.get('SUPABASE_URL') ?? '',
        // @ts-ignore
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    ).auth.getUser();
    if (!user) throw new Error("Authentication failed.");

    const { targetId, isUser } = await req.json();
    if (!targetId) throw new Error("Missing 'targetId'.");
    
    const message = `This is a test message from the website, sent by **${user.user_metadata.full_name}**.`;

    if (isUser) {
      await forwardToBot('/api/send-dm', { userId: targetId, message });
    } else {
      await forwardToBot('/api/send-test-message', { channelId: targetId, message });
    }

    return createResponse({ message: 'Test sent successfully.' });

  } catch (error) {
    return createResponse({ error: `An unexpected error occurred: ${error.message}` }, 500);
  }
});
