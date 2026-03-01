local sx, sy = guiGetScreenSize()
local webBrowser = nil
local guiBrowser = nil
local isUIVisible = false
local isBrowserReady = false

function toggleLinkingUI()
    if isUIVisible then
        if isElement(guiBrowser) then destroyElement(guiBrowser) end
        showCursor(false)
        guiBrowser = nil
        webBrowser = nil
        isUIVisible = false
        isBrowserReady = false
    else
        guiBrowser = guiCreateBrowser(0, 0, sx, sy, true, true, false)
        if not guiBrowser then return end
        
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

bindKey("f5", "down", toggleLinkingUI)

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
        local safeCode = tostring(code):gsub("'", "\\'")
        executeBrowserJavascript(webBrowser, "updateUI({isLinked: false, code: '" .. safeCode .. "', expiresAt: " .. tostring(expiresAt) .. "})")
    end
end)

addEvent("onReceiveStatusUpdate", true)
addEventHandler("onReceiveStatusUpdate", root, function(data)
    if isElement(webBrowser) and isBrowserReady then
        local json = toJSON(data)
        json = string.sub(json, 2, #json - 1)
        executeBrowserJavascript(webBrowser, "updateUI(" .. json .. ")")
    end
end)
