-- جلب الإعدادات من ملف config.lua السري
local dbConfig = Config.Database
local apiKey = Config.Discord.secret
local botToken = Config.Discord.token

-- محاولة الاتصال بقاعدة البيانات
local db = dbConnect("mysql", "dbname="..dbConfig.name..";host="..dbConfig.host..";port="..dbConfig.port, dbConfig.user, dbConfig.pass, "share=1")

if not db then
    outputDebugString("Linking-Mod: [ERROR] Database connection failed! Check config.lua", 1)
else
    outputDebugString("Linking-Mod: [SUCCESS] Connected to Database via config.lua", 3)
end

-- نظام الـ Cooldown من جهة السيرفر
local playerCooldowns = {}

function getPlayerLinkStatus(player, callback)
    if not isElement(player) then return end
    local account = getPlayerAccount(player)
    if isGuestAccount(account) then 
        callback({ isLinked = false })
        return 
    end
    
    local accountName = getAccountName(account)
    dbQuery(function(qh)
        local result = dbPoll(qh, 0)
        if result and result[1] and result[1].discord_id then
            local discordId = result[1].discord_id
            local discordUsername = result[1].discord_username
            
            -- جلب الصورة الحقيقية من Discord API (طلب المستخدم)
            if botToken and botToken ~= "" then
                fetchRemote("https://discord.com/api/v10/users/" .. discordId, {
                    headers = {
                        ["Authorization"] = "Bot " .. botToken,
                        ["Content-Type"] = "application/json"
                    },
                    method = "GET"
                }, function(data, err)
                    local realAvatar = result[1].discord_avatar or "https://cdn.discordapp.com/embed/avatars/0.png"
                    if data and data ~= "" then
                        local parsed = fromJSON(data)
                        if parsed then
                            if parsed.avatar then
                                local ext = parsed.avatar:sub(1,2) == "a_" and "gif" or "png"
                                realAvatar = "https://cdn.discordapp.com/avatars/" .. discordId .. "/" .. parsed.avatar .. "." .. ext .. "?size=256"
                            else
                                -- إذا لم يكن لديه صورة، نستخدم الصورة الافتراضية لديسكورد
                                local defaultAvatarIndex = 0
                                if parsed.discriminator and parsed.discriminator ~= "0" then
                                    defaultAvatarIndex = tonumber(parsed.discriminator) % 5
                                else
                                    -- (userId >> 22) % 6
                                    defaultAvatarIndex = math.floor(tonumber(discordId) / 4194304) % 6
                                end
                                realAvatar = "https://cdn.discordapp.com/embed/avatars/" .. defaultAvatarIndex .. ".png"
                            end
                            -- تحديث قاعدة البيانات بالصورة الجديدة
                            dbExec(db, "UPDATE accounts SET discord_avatar = ?, discord_username = ? WHERE discord_id = ? LIMIT 1", realAvatar, parsed.username or discordUsername, discordId)
                        end
                    end
                    callback({
                        isLinked = true,
                        discordId = discordId,
                        username = discordUsername,
                        avatar = realAvatar
                    })
                end)
            else
                -- في حال عدم وجود توكن، نستخدم الصورة المخزنة
                callback({
                    isLinked = true,
                    discordId = discordId,
                    username = discordUsername,
                    avatar = result[1].discord_avatar or "https://cdn.discordapp.com/embed/avatars/0.png"
                })
            end
        else
            callback({ isLinked = false })
        end
    end, db, "SELECT discord_id, discord_username, discord_avatar FROM accounts WHERE username = ? LIMIT 1", accountName)
end

function generateNewCodeForPlayer(player)
    local serial = getPlayerSerial(player)
    local playerName = getPlayerName(player)
    
    -- الثغرة #7: استخدام UUID() من قاعدة البيانات لضمان عشوائية آمنة تشفيرياً (CSPRNG)
    dbQuery(function(qh)
        local result = dbPoll(qh, 0)
        if not result or not result[1] or not result[1].uuid then
            outputDebugString("Linking-Mod: [ERROR] Failed to generate UUID from Database", 1)
            return
        end
        
        -- تنظيف الـ UUID وتحويله لكود بطول 32 حرفاً
        local code = result[1].uuid:gsub("-", "")
        -- تكرار الكود ليكمل 32 حرفاً إذا لزم الأمر (UUID هو 32 حرف فعلياً بدون الشرطات)
        if #code < 32 then code = code .. string.sub("ABCDEF0123456789", 1, 32 - #code) end
        
        local expirySeconds = 300
        
        dbExec(db, "INSERT INTO linking_codes (code, mta_serial, expires_at) VALUES (?, ?, NOW() + INTERVAL ? SECOND) ON DUPLICATE KEY UPDATE code = ?, expires_at = NOW() + INTERVAL ? SECOND", 
            code, serial, expirySeconds, code, expirySeconds)
        
        if apiKey and apiKey ~= "" then
            fetchRemote("http://localhost:3001/log/mta-code", {
                headers = { 
                    ["Authorization"] = apiKey,
                    ["Content-Type"] = "application/json"
                },
                postData = toJSON({ mtaserial = serial, code = code, playerName = playerName }),
                method = "POST"
            }, function(data, err) end)
        end

        -- الثغرة #10: نرسل فقط الكود ووقت الانتهاء للاعب، ولا نرسل السيريال أبداً للمتصفح
        triggerClientEvent(player, "onReceiveNewCode", player, code, os.time() + expirySeconds)
    end, db, "SELECT UUID() as uuid")
end

addEvent("onRequestNewCode", true)
addEventHandler("onRequestNewCode", root, function()
    local player = client
    local account = getPlayerAccount(player)
    if isGuestAccount(account) then
        outputChatBox("يجب عليك تسجيل الدخول أولاً!", player, 255, 0, 0)
        return
    end

    local serial = getPlayerSerial(player)
    
    if playerCooldowns[serial] and (os.time() - playerCooldowns[serial]) < 10 then
        outputChatBox("يرجى الانتظار قليلاً قبل طلب كود جديد!", player, 255, 255, 0)
        return
    end
    playerCooldowns[serial] = os.time()

    dbQuery(function(qh)
        local res = dbPoll(qh, 0)
        if res and res[1] then
            triggerClientEvent(player, "onReceiveNewCode", player, res[1].code, res[1].exp)
        else
            generateNewCodeForPlayer(player)
        end
    end, db, "SELECT code, UNIX_TIMESTAMP(expires_at) as exp FROM linking_codes WHERE mta_serial = ? AND expires_at > NOW() LIMIT 1", serial)
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
            end, db, "SELECT code, UNIX_TIMESTAMP(expires_at) as exp FROM linking_codes WHERE mta_serial = ? AND expires_at > NOW() LIMIT 1", serial)
        else
            triggerClientEvent(player, "onReceiveStatusUpdate", player, data)
        end
    end)
end)

addEventHandler("onPlayerLogin", root, function(_, account)
    local serial = getPlayerSerial(source)
    local accountName = getAccountName(account)
    -- الثغرة #9: إضافة LIMIT 1
    dbExec(db, "UPDATE accounts SET mtaserial = ? WHERE username = ? LIMIT 1", serial, accountName)
end)
