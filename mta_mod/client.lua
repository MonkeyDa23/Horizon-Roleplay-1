local sx, sy = guiGetScreenSize()
local webBrowser = nil
local guiBrowser = nil
local isUIVisible = false
local isBrowserReady = false

local statusTimeout = nil

function toggleLinkingUI()
    -- إذا كان هناك متصفح، نقوم بإغلاقه فوراً
    if isElement(guiBrowser) then
        destroyElement(guiBrowser)
        guiBrowser = nil
        webBrowser = nil
        isUIVisible = false
        isBrowserReady = false
        showCursor(false)
        if isTimer(statusTimeout) then killTimer(statusTimeout) end
        return
    end

    -- الحماية من التكرار العشوائي
    if isUIVisible then return end
    isUIVisible = true

    -- التأكد من تصفير المتغيرات قبل البدء
    guiBrowser = nil
    webBrowser = nil
    isBrowserReady = false

    guiBrowser = guiCreateBrowser(0, 0, sx, sy, true, true, false)
    if not guiBrowser then 
        isUIVisible = false
        outputChatBox("Nova Linking: [ERROR] فشل إنشاء المتصفح! تأكد من إعطاء الصلاحيات (ACL).", 255, 0, 0)
        return 
    end
    
    guiSetAlpha(guiBrowser, 1)
    webBrowser = guiGetBrowser(guiBrowser)
    
    addEventHandler("onClientBrowserCreated", webBrowser, function()
        if source ~= webBrowser then return end
        loadBrowserURL(source, "http://mta/local/html/index.html")
        focusBrowser(source)
    end)

    addEventHandler("onClientBrowserDocumentReady", webBrowser, function()
        if source ~= webBrowser then return end
        isBrowserReady = true
        showCursor(true)
        
        -- طلب الحالة مع مهلة زمنية 15 ثانية
        if isTimer(statusTimeout) then killTimer(statusTimeout) end
        statusTimeout = setTimer(function()
            if isElement(webBrowser) and isBrowserReady then
                executeBrowserJavascript(webBrowser, "updateUI({error: 'تأخر الرد من السيرفر. تأكد من تشغيل الموقع وقاعدة البيانات.'})")
                isUIVisible = false
                outputDebugString("Nova Linking: [WARNING] Status update timeout reached.", 2)
            end
        end, 15000, 1)

        outputDebugString("Nova Linking: [INFO] Requesting status update for " .. getPlayerName(localPlayer), 3)
        triggerServerEvent("onRequestStatusUpdate", localPlayer)
    end)
end

-- ربط المفتاح F5 والأمر /link عند تشغيل المود
addEventHandler("onClientResourceStart", resourceRoot, function()
    unbindKey("f5", "down", toggleLinkingUI)
    bindKey("f5", "down", toggleLinkingUI)
    outputChatBox("#00BFFF[Nova Linking]: #FFFFFFالمود جاهز للاستخدام. اضغط #00BFFF F5 #FFFFFFلفتح لوحة الربط.", 255, 255, 255, true)
end)

addCommandHandler("link", toggleLinkingUI)
addCommandHandler("ربط", toggleLinkingUI)

addEvent("onClientRequestNewCode", true)
addEventHandler("onClientRequestNewCode", root, function()
    triggerServerEvent("onRequestNewCode", localPlayer)
end)

addEvent("onClientRequestStatusUpdate", true)
addEventHandler("onClientRequestStatusUpdate", root, function()
    triggerServerEvent("onRequestStatusUpdate", localPlayer)
end)

addEvent("onReceiveNewCode", true)
addEventHandler("onReceiveNewCode", root, function(code, expiresAt)
    if isElement(webBrowser) and isBrowserReady then
        -- الثغرة #5: تعقيم الكود عبر تحويله لـ JSON بالكامل
        local data = {
            isLinked = false,
            code = code,
            expiresAt = expiresAt
        }
        local json = toJSON(data)
        -- تنظيف الـ JSON من الأقواس المربعة التي يضيفها MTA
        json = string.sub(json, 2, #json - 1)
        executeBrowserJavascript(webBrowser, "updateUI(" .. json .. ")")
    end
end)

addEvent("onReceiveStatusUpdate", true)
addEventHandler("onReceiveStatusUpdate", root, function(data)
    if isTimer(statusTimeout) then killTimer(statusTimeout) end
    if isElement(webBrowser) and isBrowserReady then
        -- إذا كان هناك كود JS محقون (لتحديث الروابط مثلاً)
        if data._js then
            executeBrowserJavascript(webBrowser, data._js)
            if not data.isLinked and data.isLinked ~= false then return end
        end

        -- الثغرة #6: تعقيم البيانات القادمة من السيرفر بالكامل
        local json = toJSON(data)
        json = string.sub(json, 2, #json - 1)
        executeBrowserJavascript(webBrowser, "updateUI(" .. json .. ")")
    end
end)
