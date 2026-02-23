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
    local account = getPlayerAccount(player)
    if isGuestAccount(account) then return false end
    
    local accountName = getAccountName(account)
    local query = dbQuery(db, "SELECT discord_id, discord_username, discord_avatar FROM accounts WHERE username = ?", accountName)
    local result = dbPoll(query, -1)
    
    if result and result[1] and result[1].discord_id then
        return {
            isLinked = true,
            discordId = result[1].discord_id,
            username = result[1].discord_username,
            avatar = result[1].discord_avatar
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
    
    -- Generate 6-digit random code
    local code = string.format("%06d", math.random(0, 999999))
    local expiry = 600 -- 10 minutes
    
    -- Insert/Update code in DB
    dbExec(db, "INSERT INTO linking_codes (code, mta_serial, expires_at) VALUES (?, ?, NOW() + INTERVAL ? SECOND) ON DUPLICATE KEY UPDATE code = ?, expires_at = NOW() + INTERVAL ? SECOND", 
        code, serial, expiry, code, expiry)
    
    -- Notify Bot for Logging
    fetchRemote("http://localhost:3001/log/mta-code", {
        headers = { 
            ["Authorization"] = "FL-RP_9x2KzL8!vQpmWn5&7ZtY2uBvR1_VXL",
            ["Content-Type"] = "application/json"
        },
        postData = toJSON({ serial = serial, code = code, playerName = playerName }),
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
