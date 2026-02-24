-- Database Configuration
local dbConfig = {
    host = "51.38.205.167",
    user = "u80078_Xpie51qdR4",
    pass = "SI^B=+4Tvm@xNGABLh1bZ^Jf",
    name = "s80078_db1771579900188",
    port = 3306
}

local db = dbConnect("mysql", "dbname="..dbConfig.name..";host="..dbConfig.host..";port="..dbConfig.port, dbConfig.user, dbConfig.pass, "share=1")

if db then
    outputDebugString("Linking System: Database connected successfully.")
else
    outputDebugString("Linking System: Database connection failed!", 1)
end

-- Function to get player link status
function getPlayerLinkStatus(player)
    if not isElement(player) then return { isLinked = false } end
    local account = getPlayerAccount(player)
    if isGuestAccount(account) then return { isLinked = false } end
    
    local accountName = getAccountName(account)
    local query = dbQuery(db, "SELECT discord_id, discord_username, discord_avatar FROM accounts WHERE username = ?", accountName)
    local result = dbPoll(query, -1)
    
    if result and result[1] and result[1].discord_id then
        return {
            isLinked = true,
            discordId = result[1].discord_id,
            username = result[1].discord_username,
            avatar = result[1].discord_avatar or "https://cdn.discordapp.com/embed/avatars/0.png"
        }
    else
        return { isLinked = false }
    end
end

-- Handle Code Generation
addEvent("onRequestNewCode", true)
addEventHandler("onRequestNewCode", root, function()
    local player = client
    local serial = getPlayerSerial(player)
    local playerName = getPlayerName(player)
    
    -- Generate 20-character code starting with flgd
    local charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    local randomPart = ""
    for i = 1, 16 do
        local r = math.random(1, #charset)
        randomPart = randomPart .. string.sub(charset, r, r)
    end
    local code = "flgd" .. randomPart
    local expiry = 600 -- 10 minutes
    
    -- Insert/Update code in DB
    dbExec(db, "INSERT INTO linking_codes (code, mta_serial, expires_at) VALUES (?, ?, NOW() + INTERVAL ? SECOND) ON DUPLICATE KEY UPDATE code = ?, expires_at = NOW() + INTERVAL ? SECOND", 
        code, serial, expiry, code, expiry)
    
    -- Notify Bot for Logging (Using mtaserial as requested)
    fetchRemote("http://localhost:3001/log/mta-code", {
        headers = { 
            ["Authorization"] = "FL-RP_9x2KzL8!vQpmWn5&7ZtY2uBvR1_VXL",
            ["Content-Type"] = "application/json"
        },
        postData = toJSON({ mtaserial = serial, code = code, playerName = playerName }),
        method = "POST"
    }, function(data, err) end)

    -- Send back to client
    triggerClientEvent(player, "onReceiveNewCode", player, code)
end)

-- Handle Status Update
addEvent("onRequestStatusUpdate", true)
addEventHandler("onRequestStatusUpdate", root, function()
    local data = getPlayerLinkStatus(client)
    triggerClientEvent(client, "onReceiveStatusUpdate", client, data)
end)

-- Ensure serial is saved to accounts table on login
addEventHandler("onPlayerLogin", root, function(_, account)
    local serial = getPlayerSerial(source)
    local accountName = getAccountName(account)
    dbExec(db, "UPDATE accounts SET mtaserial = ? WHERE username = ?", serial, accountName)
    outputDebugString("Linking System: Updated serial for account " .. accountName)
end)
