-- Configuration (MUST BE FILLED MANUALLY BY SERVER OWNER)
local SUPABASE_URL = 'YOUR_SUPABASE_URL'       -- e.g., 'https://xxxxxxxx.supabase.co'
local SUPABASE_KEY = 'YOUR_SUPABASE_ANON_KEY' -- The public anon key
local WEBSITE_BASE_URL = 'YOUR_WEBSITE_URL'     -- e.g., 'https://your-app.vercel.app'

-- This secret must match the one in your Supabase RPC function
local SECRET_KEY = 'FL-RP_9x2KzL8!vQp$mWn5&7Zt*Y2uBvR1_VXL'

-- Function to generate a secure, random code
function generateSecureCode()
    local chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    local code = 'VXL-'
    for i = 1, 12 do
        if i == 6 then
            code = code .. '-'
        end
        local randChar = math.random(1, #chars)
        code = code .. string.sub(chars, randChar, randChar)
    end
    return code
end

-- Event handler for when a player requests their link status
addEvent('onPlayerRequestLinkStatus', true)
addEventHandler('onPlayerRequestLinkStatus', root, function()
    local player = client
    local playerSerial = getPlayerSerial(player)

    -- Use the website's API to check the status
    local url = WEBSITE_BASE_URL .. '/api/mta/status/' .. playerSerial
    fetchRemote(url, function(responseBody, httpCode)
        if httpCode == 200 then
            local data = fromJSON(responseBody)
            if data and data.isLinked then
                triggerClientEvent(player, 'onClientUpdateUIVisibility', player, 'linked', { discordUser = data.discordUser })
            else
                triggerClientEvent(player, 'onClientUpdateUIVisibility', player, 'unlinked', nil)
            end
        else
            -- Handle error - maybe the website is down
            triggerClientEvent(player, 'onClientUpdateUIVisibility', player, 'unlinked', nil)
            outputDebugString('Failed to fetch link status for ' .. playerSerial .. '. HTTP Code: ' .. httpCode)
        end
    end)
end)

-- Event handler for when a player requests a new link code
addEvent('onPlayerRequestNewLinkCode', true)
addEventHandler('onPlayerRequestNewLinkCode', root, function()
    local player = client
    local playerSerial = getPlayerSerial(player)

    -- Call Supabase RPC to generate the code
    local rpcUrl = SUPABASE_URL .. '/rest/v1/rpc/generate_mta_link_code'
    local postData = toJSON({ 
        p_serial = playerSerial,
        p_secret_key = SECRET_KEY
    })

    fetchRemote(rpcUrl, {
        method = 'POST',
        headers = {
            ['apikey'] = SUPABASE_KEY,
            ['Authorization'] = 'Bearer ' .. SUPABASE_KEY,
            ['Content-Type'] = 'application/json',
            ['Prefer'] = 'params=single-object'
        },
        postData = postData
    }, function(responseBody, httpCode)
        if httpCode == 200 then
            local data = fromJSON(responseBody)
            if data.success then
                triggerClientEvent(player, 'onClientUpdateUIVisibility', player, 'showCode', { code = data.code })
            else
                triggerClientEvent(player, 'onClientUpdateUIVisibility', player, 'cooldown', { message = data.message })
            end
        else
            outputDebugString('Error generating code for ' .. playerSerial .. '. HTTP Code: ' .. httpCode .. ' Body: ' .. responseBody)
            triggerClientEvent(player, 'onClientUpdateUIVisibility', player, 'cooldown', { message = 'حدث خطأ في الخادم، يرجى المحاولة مرة أخرى.' })
        end
    end)
end)

-- Event handler for when a player requests to unlink their account
addEvent('onPlayerRequestUnlink', true)
addEventHandler('onPlayerRequestUnlink', root, function()
    local player = client
    local playerSerial = getPlayerSerial(player)

    local url = WEBSITE_BASE_URL .. '/api/mta/unlink'
    local postData = toJSON({ serial = playerSerial })

    fetchRemote(url, {
        method = 'POST',
        headers = { ['Content-Type'] = 'application/json' },
        postData = postData
    }, function(responseBody, httpCode)
        if httpCode == 200 then
            -- Success, refresh the UI to show unlinked state
            triggerEvent('onPlayerRequestLinkStatus', player)
        else
            -- Handle error, maybe notify the player
            outputDebugString('Failed to unlink account for ' .. playerSerial .. '. HTTP Code: ' .. httpCode)
        end
    end)
end)
