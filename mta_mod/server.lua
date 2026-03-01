local dbConfig = {
    host = "51.38.205.167",
    user = "u80078_Xpie51qdR4",
    pass = "SI^B=+4Tvm@xNGABLh1bZ^Jf",
    name = "s80078_db1771579900188",
    port = 3306
}

local db = dbConnect("mysql", "dbname="..dbConfig.name..";host="..dbConfig.host..";port="..dbConfig.port, dbConfig.user, dbConfig.pass, "share=1")

if not db then
    outputDebugString("DB Connection Failed", 1)
end

function getPlayerLinkStatus(player, callback)
    if not isElement(player) then 
        callback({ isLinked = false })
        return 
    end
    
    local account = getPlayerAccount(player)
    if isGuestAccount(account) then 
        callback({ isLinked = false })
        return 
    end
    
    local accountName = getAccountName(account)
    dbQuery(function(qh)
        local result = dbPoll(qh, 0)
        if result and result[1] and result[1].discord_id then
            callback({
                isLinked = true,
                discordId = result[1].discord_id,
                username = result[1].discord_username,
                avatar = result[1].discord_avatar or "https://cdn.discordapp.com/embed/avatars/0.png"
            })
        else
            callback({ isLinked = false })
        end
    end, db, "SELECT discord_id, discord_username, discord_avatar FROM accounts WHERE username = ?", accountName)
end

addEvent("onRequestNewCode", true)
addEventHandler("onRequestNewCode", root, function()
    local player = client
    local serial = getPlayerSerial(player)
    local playerName = getPlayerName(player)
    
    dbQuery(function(qh)
        local res = dbPoll(qh, 0)
        if res and res[1] then
            triggerClientEvent(player, "onReceiveNewCode", player, res[1].code, res[1].exp)
        else
            local charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*"
            local code = ""
            for i = 1, 24 do
                local r = math.random(1, #charset)
                code = code .. string.sub(charset, r, r)
            end
            
            local expirySeconds = 600 -- 10 minutes for complex codes
            
            dbExec(db, "INSERT INTO linking_codes (code, mta_serial, expires_at) VALUES (?, ?, NOW() + INTERVAL ? SECOND) ON DUPLICATE KEY UPDATE code = ?, expires_at = NOW() + INTERVAL ? SECOND", 
                code, serial, expirySeconds, code, expirySeconds)
            
            -- Update to match the bot's actual port and key
            fetchRemote("http://127.0.0.1:15139/log/mta-code", {
                headers = { 
                    ["Authorization"] = "201119851976lockdiscord54377rugjrtg754g5uiugjyijhj596jh6j0jj60oij6okjk6ojk60j6k0k0i67j",
                    ["Content-Type"] = "application/json"
                },
                postData = toJSON({ mtaserial = serial, code = code, playerName = playerName }),
                method = "POST"
            }, function(data, err) end)

            local currentTimestamp = os.time()
            triggerClientEvent(player, "onReceiveNewCode", player, code, currentTimestamp + expirySeconds)
        end
    end, db, "SELECT code, UNIX_TIMESTAMP(expires_at) as exp FROM linking_codes WHERE mta_serial = ? AND expires_at > NOW()", serial)
end)

addEvent("onRequestStatusUpdate", true)
addEventHandler("onRequestStatusUpdate", root, function()
    local player = client
    local serial = getPlayerSerial(player)
    
    getPlayerLinkStatus(player, function(data)
        if not data.isLinked then
            dbQuery(function(qh)
                local res = dbPoll(qh, 0)
                if res and res[1] then
                    data.code = res[1].code
                    data.expiresAt = res[1].exp
                end
                triggerClientEvent(player, "onReceiveStatusUpdate", player, data)
            end, db, "SELECT code, UNIX_TIMESTAMP(expires_at) as exp FROM linking_codes WHERE mta_serial = ? AND expires_at > NOW()", serial)
        else
            triggerClientEvent(player, "onReceiveStatusUpdate", player, data)
        end
    end)
end)

addEventHandler("onPlayerLogin", root, function(_, account)
    local serial = getPlayerSerial(source)
    local accountName = getAccountName(account)
    dbExec(db, "UPDATE accounts SET mtaserial = ? WHERE username = ?", serial, accountName)
end)

-- --- Faction Discord Bridge ---

local botConfig = {
    -- IMPORTANT: Use your App URL with /api/proxy/ path
    url = "https://ais-dev-ybw2kepvyjl3nudev22cgi-28074720729.europe-west2.run.app/api/proxy/faction/event",
    key = "201119851976lockdiscord54377rugjrtg754g5uiugjyijhj596jh6j0jj60oij6okjk6ojk60j6k0k0i67j"
}

function triggerFactionEvent(eventType, factionId, factionName, player, officer, oldRank, newRank, reason, extra)
    if not eventType or not factionId then return false end

    local data = {
        type = eventType,
        factionId = tonumber(factionId),
        factionName = factionName or "Faction "..tostring(factionId),
        playerAccount = player and getPlayerAccount(player) and not isGuestAccount(getPlayerAccount(player)) and getAccountName(getPlayerAccount(player)) or "Guest",
        playerChar = player and getPlayerName(player):gsub("_", " ") or "Unknown",
        playerId = player and getElementData(player, "dbid") or 0,
        officerAccount = officer and getPlayerAccount(officer) and not isGuestAccount(getPlayerAccount(officer)) and getAccountName(getPlayerAccount(officer)) or "System",
        officerChar = officer and getPlayerName(officer):gsub("_", " ") or "النظام",
        officerId = officer and getElementData(officer, "dbid") or 0,
        oldRankName = oldRank or "",
        newRankName = newRank or "",
        rankName = newRank or oldRank or "",
        reason = reason or "لا يوجد سبب",
        vehicleModel = extra and extra.model or "",
        vehicleId = extra and extra.id or 0
    }

    fetchRemote(botConfig.url, {
        headers = { ["Authorization"] = botConfig.key, ["Content-Type"] = "application/json" },
        postData = toJSON(data),
        method = "POST"
    }, function(responseData, errorNo) end)

    return true
end

