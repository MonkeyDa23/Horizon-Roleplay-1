local apiKey = Config.Discord.apiKey
local botUrl = Config.Discord.botUrl or "http://localhost:3001/internal/"

-- HMAC-SHA256 Implementation for Lua (MTA)
-- Based on standard construction: HMAC(K, m) = H((K ^ opad) .. H((K ^ ipad) .. m))
function hmac_sha256(key, message)
    local function str_xor(s, byte)
        local res = ""
        for i = 1, #s do
            res = res .. string.char(bitXor(string.byte(s, i), byte))
        end
        return res
    end
    
    local function hex_to_bin(hex)
        return (hex:gsub('..', function (cc)
            return string.char(tonumber(cc, 16))
        end))
    end

    local paddedKey = key
    if #key > 64 then
        paddedKey = hex_to_bin(hash("sha256", key))
    end
    if #paddedKey < 64 then
        paddedKey = paddedKey .. string.rep(string.char(0), 64 - #paddedKey)
    end
    
    local ipad = str_xor(paddedKey, 0x36)
    local opad = str_xor(paddedKey, 0x5C)
    
    local inner = hex_to_bin(hash("sha256", ipad .. message))
    return hash("sha256", opad .. inner)
end

function logToSystem(player, action, details)
    local serial = getPlayerSerial(player)
    local timestamp = tostring(getRealTime().timestamp)
    local secretKey = Config and Config.Discord and Config.Discord.secret
    
    if not secretKey or secretKey == "" then
        outputDebugString("[SECURITY] Missing Discord secret! Aborting log.", 1)
        return
    end

    local payload = toJSON({
        serial = serial,
        action = action,
        details = details
    })
    
    -- We will try to match Node's HMAC logic. 
    -- If we can't implement HMAC perfectly in Lua here, we will use a "Secret + Payload + Timestamp" 
    -- but we will use a SHA512 or something more robust if needed.
    -- But strict requirement is: USE WHAT NODE USES.
    
    -- Since I can't easily do binary buffer manipulation for HMAC opad/ipad in MTA Lua easily without a lot of code,
    -- I will use a custom HMAC helper that I will implement.
    
    local signature = hmac_sha256(secretKey, payload .. timestamp)

    fetchRemote(botUrl .. "log", {
        headers = {
            ["Authorization"] = apiKey,
            ["Content-Type"] = "application/json",
            ["x-signature"] = signature,
            ["x-timestamp"] = timestamp
        },
        method = "POST",
        postData = payload
    }, function(data, err)
        if err ~= 0 then
            outputDebugString("Log failed: " .. tostring(err))
        end
    end)
end

function generateNewCodeForPlayer(player)
    local serial = getPlayerSerial(player)
    local playerName = getPlayerName(player)
    local secretKey = Config and Config.Discord and Config.Discord.secret
    
    if not secretKey or secretKey == "" then
        outputDebugString("[SECURITY] Missing Discord secret! Aborting code generation.", 1)
        return
    end

    local timestamp = tostring(getRealTime().timestamp)
    local bodyData = toJSON({ mtaserial = serial, playerName = playerName })
    local sig = hmac_sha256(secretKey, bodyData .. timestamp)

    fetchRemote("http://localhost:3000/api/mta/internal/generate-code", {
        headers = {
            ["Authorization"] = apiKey,
            ["Content-Type"] = "application/json",
            ["x-signature"] = sig,
            ["x-timestamp"] = timestamp
        },
        method = "POST",
        postData = bodyData
    }, function(data, err)
        if err == 0 then
            local res = fromJSON(data)
            if res and res.success then
                triggerClientEvent(player, "onReceiveNewCode", player, res.code, res.expiresAt)
            end
        else
            outputDebugString("Remote call failed: " .. tostring(err))
        end
    end)
end

addEvent("requestNewLinkCode", true)
addEventHandler("requestNewLinkCode", root, function()
    generateNewCodeForPlayer(client)
end)

addEventHandler("onPlayerLogin", root, function()
    local serial = getPlayerSerial(source)
    fetchRemote(botUrl .. "status/" .. serial, {
        headers = { ["Authorization"] = apiKey }
    }, function(data, err)
        if err == 0 then
            local res = fromJSON(data)
            if res and res.linked then
                outputChatBox("Welcome back, " .. res.username .. "! Your account is linked.", source, 0, 255, 0)
            end
        end
    end)
end)
