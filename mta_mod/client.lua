local sx, sy = guiGetScreenSize()
local webBrowser = nil
local guiBrowser = nil
local isUIVisible = false
local isBrowserReady = false

function toggleLinkingUI()
    -- التأكد من أن اللاعب ليس في حالة انتقال أو انتظار
    if isUIVisible then
        if isElement(guiBrowser) then destroyElement(guiBrowser) end
        showCursor(false)
        guiBrowser = nil
        webBrowser = nil
        isUIVisible = false
        isBrowserReady = false
        -- outputChatBox("Linking-Mod: تم إغلاق القائمة.", 255, 255, 255)
    else
        -- outputChatBox("Linking-Mod: جاري فتح القائمة...", 255, 255, 0)
        guiBrowser = guiCreateBrowser(0, 0, sx, sy, true, true, false)
        if not guiBrowser then 
            outputChatBox("Linking-Mod: فشل إنشاء المتصفح! تأكد من إعطاء الصلاحيات.", 255, 0, 0)
            return 
        end
        
        guiSetAlpha(guiBrowser, 0)
        webBrowser = guiGetBrowser(guiBrowser)
        
        addEventHandler("onClientBrowserCreated", webBrowser, function()
            loadBrowserURL(source, "http://mta/local/html/index.html")
        end)

        addEventHandler("onClientBrowserDocumentReady", webBrowser, function()
            isBrowserReady = true
            showCursor(true)
            isUIVisible = true
            triggerServerEvent("onRequestStatusUpdate", localPlayer)
            
            local alpha = 0
            setTimer(function()
                alpha = alpha + 0.1
                if alpha > 1 then alpha = 1 end
                if isElement(guiBrowser) then guiSetAlpha(guiBrowser, alpha) end
            end, 30, 10)
        end)
    end
end

-- ربط المفتاح F5 والأمر /link عند تشغيل المود
addEventHandler("onClientResourceStart", resourceRoot, function()
    bindKey("f5", "down", toggleLinkingUI)
    -- outputChatBox("Linking-Mod: اضغط F5 أو اكتب /link لفتح قائمة الربط.", 0, 255, 0)
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
    if isElement(webBrowser) and isBrowserReady then
        -- الثغرة #6: تعقيم البيانات القادمة من السيرفر بالكامل
        local json = toJSON(data)
        json = string.sub(json, 2, #json - 1)
        executeBrowserJavascript(webBrowser, "updateUI(" .. json .. ")")
    end
end)
