
-- MTA:SA Account Link Mod - Server Side (Enhanced Security)
-- Author: AI Assistant

local SUPABASE_URL = "https://ais-pre-ybw2kepvyjl3nudev22cgi-28074720729.europe-west2.run.app" -- Replace with your actual Supabase URL
local SUPABASE_KEY = "YOUR_SUPABASE_ANON_KEY" -- Replace with your actual Supabase ANON Key
local WEBSITE_BASE_URL = "https://ais-pre-ybw2kepvyjl3nudev22cgi-28074720729.europe-west2.run.app" -- Replace with your actual website URL
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
    iprint("[MTA Server] Attempting to generate link code for serial: " .. serial)
    iprint("[MTA Server] Generated complex code: " .. complexCode)
    
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
    
    local rpcUrl = SUPABASE_URL .. "/rest/v1/rpc/generate_mta_link_code"
    iprint("[MTA Server] Calling Supabase RPC: " .. rpcUrl)
    outputDebugString("[MTA Server] Calling Supabase RPC with data: " .. toJSON(postData))

    fetchRemote(rpcUrl, options, function(data, info)
        if info.success then
            local code = data:gsub('"', '') 
            iprint("[MTA Server] Successfully generated code: " .. code)
            triggerClientEvent(player, "onClientReceiveLinkCode", player, code)
        else
            iprint("[MTA Server] Failed to generate code. Error: " .. tostring(info.errCode) .. " - " .. tostring(data))
            outputDebugString("[Vixel] Failed to generate code. Error: " .. tostring(info.errCode) .. " - " .. tostring(data))
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
    
    iprint("[MTA Server] Checking link status for serial: " .. serial)
    outputDebugString("[MTA Server] Checking link status for serial: " .. serial)
    
    local options = {
        method = "GET",
        headers = {
            ["apikey"] = SUPABASE_KEY, -- Not strictly needed for GET to our own API, but good practice
            ["Authorization"] = "Bearer " .. SUPABASE_KEY -- Not strictly needed for GET to our own API, but good practice
        }
    }
    
    local url = WEBSITE_BASE_URL .. "/api/mta/status/" .. serial
    iprint("[MTA Server] Calling API for link status: " .. url)
    outputDebugString("[MTA Server] Calling API for link status: " .. url)
    
    fetchRemote(url, options, function(data, info)
        if info.success then
            local res = fromJSON(data)
            iprint("[MTA Server] API response for link status: " .. tostring(data))
            outputDebugString("[MTA Server] API response for link status: " .. tostring(data))
            if res and res.linked then
                iprint("[MTA Server] Serial " .. serial .. " is linked to Discord ID: " .. res.discord.id)
                triggerClientEvent(player, "onClientReceiveLinkStatus", player, "linked", res.discord)
            else
                iprint("[MTA Server] Serial " .. serial .. " is unlinked.")
                triggerClientEvent(player, "onClientReceiveLinkStatus", player, "unlinked", nil)
            end
        else
            iprint("[MTA Server] FetchRemote failed for link status. Error code: " .. tostring(info.errCode) .. " - " .. tostring(data))
            outputDebugString("[Vixel] FetchRemote failed for link status. Error code: " .. tostring(info.errCode) .. " - " .. tostring(data))
            triggerClientEvent(player, "onClientReceiveLinkStatus", player, "unlinked", nil)
        end
    end)
end)

-- Unlink Request
addEvent("onServerRequestUnlink", true)
addEventHandler("onServerRequestUnlink", root, function()
    local player = client
    local serial = getPlayerSerial(player)
    
    iprint("[MTA Server] Received unlink request for serial: " .. serial)
    outputDebugString("[MTA Server] Received unlink request for serial: " .. serial)

    local options = {
        method = "POST",
        headers = {
            ["Content-Type"] = "application/json"
        },
        postData = toJSON({ serial = serial })
    }
    
    local url = WEBSITE_BASE_URL .. "/api/mta/unlink"
    iprint("[MTA Server] Calling API for unlink: " .. url)
    outputDebugString("[MTA Server] Calling API for unlink: " .. url)

    fetchRemote(url, options, function(data, info)
        if info.success then
            outputChatBox("#00f2ea[Vixel] #ffffffتم إلغاء ربط الحساب بنجاح.", player, 255, 255, 255, true)
            triggerClientEvent(player, "onClientReceiveLinkStatus", player, "unlinked", nil)
        else
            outputChatBox("#ff4444[Vixel] #ffffffفشل في إلغاء الربط.", player, 255, 255, 255, true)
        end
    end)
end)
