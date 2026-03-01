import { Client, GatewayIntentBits, Events, Interaction, CacheType, Partials, REST, Routes } from 'discord.js';
import { env } from './env.js';
import { commands } from './bot_linking_module/command-definitions.js';
import { setupCoreModule } from './core_module/index.js';
import { setupFactionSync } from './core_module/faction_sync.js';

// Import command handlers
import { handleLinkCommand } from './bot_linking_module/commands/link.js';
import { handleUnlinkCommand } from './bot_linking_module/commands/unlink.js';
import { handleShowLinkStatusCommand } from './bot_linking_module/commands/showstatus.js';
import { handleForceUnlinkCommand } from './bot_linking_module/commands/forceunlink.js';
import { logToDiscord } from './bot_linking_module/utils.js';

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages
    ],
    partials: [Partials.Channel, Partials.GuildMember, Partials.User]
});

const registerCommands = async () => {
    if (!env.DISCORD_BOT_TOKEN || !env.DISCORD_CLIENT_ID) return;
    const rest = new REST({ version: '10' }).setToken(env.DISCORD_BOT_TOKEN);
    try {
        await rest.put(Routes.applicationCommands(env.DISCORD_CLIENT_ID), { body: commands });
        console.log('✅ Commands registered');
    } catch (error) {
        console.error('❌ Command registration failed:', error);
    }
};

client.once(Events.ClientReady, async (c) => {
    console.log(`✅ Merged Bot is online! Logged in as ${c.user.tag}`);
    console.log(`📡 API URL: ${env.VITE_DISCORD_BOT_API_URL || 'Not Set'}`);
    console.log(`🔑 API KEY: ${env.API_SECRET_KEY ? 'Set (Hidden)' : 'Not Set'}`);
    
    await registerCommands();
    setupCoreModule(client); // Start the Express API
    setupFactionSync(client); // Start the Faction Sync System
    
    await logToDiscord(client, 'SUCCESS', '🚀 تشغيل النظام المدمج', 'تم تشغيل البوت بنجاح ودمج نظام الربط مع نظام الموقع واللوجات ونظام مزامنة الرتب التلقائي.', 'ADMIN', [
        { name: 'الحالة', value: 'متصل', inline: true },
        { name: 'المنفذ', value: env.PORT.toString(), inline: true }
    ]);
});

client.on(Events.InteractionCreate, async (interaction: Interaction<CacheType>) => {
    if (!interaction.isChatInputCommand()) return;
    const { commandName, user } = interaction;

    try {
        // Log command usage
        await logToDiscord(client, 'INFO', '⌨️ استخدام أمر', `قام المستخدم باستخدام أمر في الديسكورد.`, 'COMMANDS', [
            { name: 'المستخدم', value: `${user.tag} (${user.id})`, inline: true },
            { name: 'الأمر', value: `/${commandName}`, inline: true }
        ]);

        if (commandName === 'link') await handleLinkCommand(interaction, client);
        else if (commandName === 'unlink') await handleUnlinkCommand(interaction, client);
        else if (commandName === 'showstatus') await handleShowLinkStatusCommand(interaction, client);
        else if (commandName === 'forceunlink') await handleForceUnlinkCommand(interaction, client);
    } catch (error) {
        console.error(error);
        const reply = { content: 'حدث خطأ أثناء تنفيذ الأمر!', ephemeral: true };
        if (interaction.replied || interaction.deferred) await interaction.followUp(reply);
        else await interaction.reply(reply);
    }
});

client.on(Events.Error, (error) => {
    console.error('Discord Client Error:', error);
});

if (env.DISCORD_BOT_TOKEN) client.login(env.DISCORD_BOT_TOKEN);
