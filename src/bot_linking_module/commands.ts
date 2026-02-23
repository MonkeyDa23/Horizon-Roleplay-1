// This file defines the slash commands for easy registration.
import { ApplicationCommandOptionType } from 'discord.js';

export const commands = [
    {
        name: 'link',
        description: 'Links your MTA account to your Discord account.',
        options: [
            {
                name: 'code',
                description: 'The link code you received in-game.',
                type: ApplicationCommandOptionType.String,
                required: true,
            },
        ],
    },
    {
        name: 'unlink',
        description: 'Unlinks your MTA account from your Discord account.',
    },
    {
        name: 'showlinkstatus',
        description: '(Admin) Shows the link status of a Discord user.',
        options: [
            {
                name: 'user',
                description: 'The Discord user to check.',
                type: ApplicationCommandOptionType.User,
                required: true,
            },
        ],
    },
    {
        name: 'forceunlink',
        description: '(Admin) Forcibly unlinks a user\'s MTA account.',
        options: [
            {
                name: 'user',
                description: 'The Discord user to unlink.',
                type: ApplicationCommandOptionType.User,
                required: true,
            },
        ],
    },
];
