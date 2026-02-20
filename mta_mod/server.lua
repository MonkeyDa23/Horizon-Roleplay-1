
-- MTA:SA Account Link Mod - Server Side
-- Author: AI Assistant

local SUPABASE_URL = "YOUR_SUPABASE_URL"
local SUPABASE_KEY = "YOUR_SUPABASE_ANON_KEY"
local SECRET_KEY = "YOUR_SUPER_SECRET_KEY_HERE"

-- Function to generate code via Supabase RPC
function generateLinkCode(player)
    local serial = getPlayerSerial(player)
    
    local postData = {
        p_serial = serial,
        p_secret_key = SECRET_KEY
    }
    
    local options = {
        method = "POST",
        headers = {
            ["apikey"] = SUPABASE_KEY,
            ["Authorization"] = "Bearer " .. SUPABASE_KEY,
            ["Content-Type"] = "application/json"
        },
        postData = toJSON(postData)
    }
    
    fetchRemote(SUPABASE_URL .. "/rest/v1/rpc/generate_mta_link_code", options, function(data, info)
        if info.success then
            local code = data:gsub('"', '') -- Remove quotes from response
            outputChatBox("#00f2ea[Vixel] #ffffffكود الربط الخاص بك هو: #00f2ea" .. code, player, 255, 255, 255, true)
            outputChatBox("#00f2ea[Vixel] #ffffffالكود صالح لمدة 10 دقائق فقط.", player, 255, 255, 255, true)
            
            -- Trigger client event to update UI if needed
            triggerClientEvent(player, "onClientReceiveLinkCode", player, code)
        else
            outputChatBox("#ff4444[Vixel] #ffffffفشل في توليد الكود. يرجى المحاولة لاحقاً.", player, 255, 255, 255, true)
        end
    end)
end

-- Command to generate code manually
addCommandHandler("link", function(player)
    generateLinkCode(player)
end)

-- You can also trigger this from the F5 menu via triggerServerEvent
addEvent("onServerRequestLinkCode", true)
addEventHandler("onServerRequestLinkCode", root, function()
    generateLinkCode(client)
end)
