import { SlashCommandBuilder } from 'discord.js';

const linkCommand = new SlashCommandBuilder()
    .setName('link')
    .setDescription('Link your MTA account to your Discord account.')
    .addStringOption(option =>
        option.setName('code')
            .setDescription('The linking code from the MTA server.')
            .setRequired(true));

const unlinkCommand = new SlashCommandBuilder()
    .setName('unlink')
    .setDescription('Unlink your MTA account from your Discord account.');

const showStatusCommand = new SlashCommandBuilder()
    .setName('showstatus')
    .setDescription('[Admin] Show the link status of a user.')
    .addUserOption(option =>
        option.setName('user')
            .setDescription('The user to check.')
            .setRequired(true));

const forceUnlinkCommand = new SlashCommandBuilder()
    .setName('forceunlink')
    .setDescription('[Admin] Forcibly unlink a user\'s MTA account.')
    .addUserOption(option =>
        option.setName('user')
            .setDescription('The user to unlink.')
            .setRequired(true));

export const commands = [
    linkCommand.toJSON(),
    unlinkCommand.toJSON(),
    showStatusCommand.toJSON(),
    forceUnlinkCommand.toJSON(),
];
