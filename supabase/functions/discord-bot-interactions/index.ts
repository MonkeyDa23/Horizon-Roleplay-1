// supabase/functions/discord-bot-interactions/index.ts

// Use the recommended npm specifier for Supabase functions types.
// This ensures Deno globals (like Deno.env) are correctly typed.
// FIX: Using URL-based type reference for better compatibility.
/// <reference types="https://esm.sh/@supabase/functions-js@2" />

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const DISCORD_BOT_TOKEN = Deno.env.get('DISCORD_BOT_TOKEN')
const DISCORD_API_BASE = 'https://discord.com/api/v10'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper to send a response
const sendResponse = (data: unknown, status = 200) => {
  return new Response(JSON.stringify(data), {
    headers: { 
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
    status,
  })
}

// Helper to send DM
async function sendDm(userId: string, embed: any) {
  if (!DISCORD_BOT_TOKEN) {
    console.error('DISCORD_BOT_TOKEN is not set.');
    return { error: 'Bot token not configured on server.' };
  }

  try {
    // 1. Create a DM channel with the user
    const dmChannelResponse = await fetch(`${DISCORD_API_BASE}/users/@me/channels`, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${DISCORD_BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ recipient_id: userId }),
    });

    if (!dmChannelResponse.ok) {
      const errorData = await dmChannelResponse.json();
      // It's common for users to have DMs disabled, so we log it but don't treat it as a critical server error.
      console.warn(`Failed to create DM channel for user ${userId}:`, errorData.message);
      return { error: 'Could not create DM channel with user. They may have DMs disabled.' };
    }
    const channel = await dmChannelResponse.json();

    // 2. Send the message to the created channel
    const messageResponse = await fetch(`${DISCORD_API_BASE}/channels/${channel.id}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${DISCORD_BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ embeds: [embed] }),
    });

    if (!messageResponse.ok) {
        const errorData = await messageResponse.json();
        console.error(`Failed to send DM to user ${userId}:`, errorData.message);
        return { error: 'Could not send DM to user.' };
    }
    
    return { success: true };

  } catch (error) {
    console.error('An unexpected error occurred in sendDm:', error);
    return { error: 'An internal error occurred.' };
  }
}

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { type, payload } = await req.json()
    let embed: any;

    const { userId, username, quizTitle, adminUsername } = payload;
    const footer = { text: "Horizon Roleplay Notifications" };

    switch (type) {
      case 'SUBMISSION_RECEIVED':
        embed = {
          title: '✅ Your Application has been Received!',
          description: `Thank you, **${username}**! We have successfully received your application for **${quizTitle}**.`,
          color: 5763719, // Green
          fields: [{
            name: 'Next Steps',
            value: 'Our staff will review your submission soon. You can check the status on the "My Applications" page on our website.'
          }],
          footer,
        };
        break;

      case 'SUBMISSION_TAKEN':
        embed = {
          title: '👀 Your Application is Under Review!',
          description: `Good news, **${username}**! Your application for **${quizTitle}** is now being reviewed.`,
          color: 3447003, // Blue
          fields: [{ name: 'Reviewer', value: `**${adminUsername}**` }],
          footer,
        };
        break;
      
      case 'SUBMISSION_ACCEPTED':
        embed = {
          title: '🎉 Congratulations! Your Application was Accepted!',
          description: `Excellent news, **${username}**! Your application for **${quizTitle}** has been **accepted**.`,
          color: 5763719, // Green
          fields: [
            { name: 'Reviewed by', value: `**${adminUsername}**` },
            { name: 'Next Steps', value: 'Please check the relevant channels on Discord for further instructions.' },
          ],
          footer,
        };
        break;

      case 'SUBMISSION_REFUSED':
        embed = {
          title: '❌ Application Update',
          description: `Hello **${username}**, after careful review, your application for **${quizTitle}** was not accepted at this time.`,
          color: 15548997, // Red
          fields: [
            { name: 'Reviewed by', value: `**${adminUsername}**` },
            { name: 'Next Steps', value: "Don't be discouraged! You may be able to re-apply in the future." },
          ],
          footer,
        };
        break;

      default:
        return sendResponse({ error: 'Invalid event type' }, 400);
    }
    
    const result = await sendDm(userId, embed);
    if (result.error) {
        // Return a success response to Supabase even if the DM fails,
        // so the database trigger doesn't error out. The error is logged internally.
        return sendResponse({ success: false, reason: result.error }, 200);
    }

    return sendResponse({ success: true });
    
  } catch (error) {
    console.error('Error in Edge Function:', error.message)
    return sendResponse({ error: 'An internal error occurred.' }, 500)
  }
})