// supabase/functions/get-discord-announcements/index.ts
// @deno-types="https://esm.sh/@supabase/functions-js@2"
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// @ts-ignore
const DISCORD_BOT_TOKEN = Deno.env.get('DISCORD_BOT_TOKEN');
const DISCORD_API_BASE = 'https://discord.com/api/v10'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper to create a response
const createResponse = (data: unknown, status = 200) => {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (!DISCORD_BOT_TOKEN) throw new Error('DISCORD_BOT_TOKEN is not configured as a secret for this function.');
    
    const supabaseAdmin = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Get Announcement Channel ID from public config table
    const { data: config, error: configError } = await supabaseAdmin.from('config').select('DISCORD_ANNOUNCEMENTS_CHANNEL_ID, DISCORD_GUILD_ID').single();
    if (configError) throw new Error(`Could not fetch website config: ${configError.message}`);
    const channelId = config.DISCORD_ANNOUNCEMENTS_CHANNEL_ID;
    const guildId = config.DISCORD_GUILD_ID;
    if (!channelId) {
        // If not configured, return empty array instead of erroring
        return createResponse([]);
    }
    
    // 2. Fetch last 5 messages from the channel
    const messagesResponse = await fetch(`${DISCORD_API_BASE}/channels/${channelId}/messages?limit=5`, {
        headers: { 'Authorization': `Bot ${DISCORD_BOT_TOKEN}` },
    });

    if (!messagesResponse.ok) {
        const errorBody = await messagesResponse.json().catch(() => ({}));
        throw new Error(`Failed to fetch messages from Discord API (${messagesResponse.status}): ${errorBody.message || 'Unknown API error'}`);
    }
    const messages = await messagesResponse.json();
    
    // 3. Format messages for the frontend
    const announcements = messages.map((msg: any) => {
        // Find the first non-empty line as title, the rest as content
        const lines = msg.content.split('\n').filter((line: string) => line.trim() !== '');
        const title = lines.length > 0 ? lines[0] : 'Announcement';
        const content = lines.length > 1 ? lines.slice(1).join('\n') : 'See details on Discord.';

        return {
            id: msg.id,
            title: title,
            content: content,
            author: {
                name: msg.author.global_name || msg.author.username,
                avatarUrl: msg.author.avatar
                    ? `https://cdn.discordapp.com/avatars/${msg.author.id}/${msg.author.avatar}.png`
                    : `https://cdn.discordapp.com/embed/avatars/${parseInt(msg.author.discriminator || '0') % 5}.png`,
            },
            timestamp: msg.timestamp,
            url: `https://discord.com/channels/${guildId}/${channelId}/${msg.id}`
        };
    });

    return createResponse(announcements);

  } catch (error) {
    console.error('Error in get-discord-announcements function:', error.message);
    return createResponse({ error: error.message }, 500);
  }
});