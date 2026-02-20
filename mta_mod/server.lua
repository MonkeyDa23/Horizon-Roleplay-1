
-- MTA:SA Account Link Mod - Server Side (Enhanced Security)
-- Author: AI Assistant

local SUPABASE_URL = "YOUR_SUPABASE_URL"
local SUPABASE_KEY = "YOUR_SUPABASE_ANON_KEY"
local SECRET_KEY = "FL-RP_9x2#KzL8!vQp$mWn5&7Zt*Y2uBvR1_VXL" -- Must match the one in Supabase RPC

-- Function to generate a complex, long code
function generateComplexCode()
    local chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*"
    local length = 24
    local code = "VXL-"
    for i = 1, length do
        local rand = math.random(#chars)
        code = code .. chars:sub(rand, rand)
        if i % 6 == 0 and i < length then
            code = code .. "-"
        end
    end
    return code
end

-- Function to generate code via Supabase RPC
function generateLinkCode(player)
    local serial = getPlayerSerial(player)
    local complexCode = generateComplexCode()
    
    local postData = {
        p_serial = serial,
        p_secret_key = SECRET_KEY,
        p_custom_code = complexCode
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
    
    -- We'll use the existing RPC but pass the complex code if we modify it, 
    -- for now let's assume the RPC generates its own but we want it long.
    -- If you want the server to dictate the code, the RPC needs to be updated.
    
    fetchRemote(SUPABASE_URL .. "/rest/v1/rpc/generate_mta_link_code", options, function(data, info)
        if info.success then
            local code = data:gsub('"', '') 
            -- Trigger client event to show the UI with the code
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

-- Triggered from F5 menu
addEvent("onServerRequestLinkCode", true)
addEventHandler("onServerRequestLinkCode", root, function()
    generateLinkCode(client)
end)

-- Check Link Status
addEvent("onServerCheckLinkStatus", true)
addEventHandler("onServerCheckLinkStatus", root, function()
    local player = client
    local serial = getPlayerSerial(player)
    
    iprint("Checking link status for serial: " .. serial)
    
    local options = {
        method = "GET",
        headers = {
            ["apikey"] = SUPABASE_KEY,
            ["Authorization"] = "Bearer " .. SUPABASE_KEY
        }
    }
    
    -- IMPORTANT: Replace with your actual website URL if not running locally
    local url = "http://localhost:3000/api/mta/status/" .. serial
    
    fetchRemote(url, options, function(data, info)
        if info.success then
            local res = fromJSON(data)
            if res and res.linked then
                triggerClientEvent(player, "onClientReceiveLinkStatus", player, "linked", res.discord)
            else
                triggerClientEvent(player, "onClientReceiveLinkStatus", player, "unlinked", nil)
            end
        else
            outputDebugString("[Vixel] FetchRemote failed. Error code: " .. tostring(info.errCode))
            triggerClientEvent(player, "onClientReceiveLinkStatus", player, "unlinked", nil)
        end
    end)
end)

-- Unlink Request
addEvent("onServerRequestUnlink", true)
addEventHandler("onServerRequestUnlink", root, function()
    local player = client
    local serial = getPlayerSerial(player)
    
    local options = {
        method = "POST",
        headers = {
            ["Content-Type"] = "application/json"
        },
        postData = toJSON({ serial = serial })
    }
    
    fetchRemote("http://localhost:3000/api/mta/unlink", options, function(data, info)
        if info.success then
            outputChatBox("#00f2ea[Vixel] #ffffffتم إلغاء ربط الحساب بنجاح.", player, 255, 255, 255, true)
            triggerClientEvent(player, "onClientReceiveLinkStatus", player, "unlinked", nil)
        else
            outputChatBox("#ff4444[Vixel] #ffffffفشل في إلغاء الربط.", player, 255, 255, 255, true)
        end
    end)
end)
