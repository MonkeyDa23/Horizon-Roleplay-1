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
        -- Create a GUI window that covers the whole screen but is invisible
        guiBrowser = guiCreateBrowser(0, 0, sx, sy, true, true, false)
        if not guiBrowser then return end
        
        webBrowser = guiGetBrowser(guiBrowser)
        
        addEventHandler("onClientBrowserCreated", webBrowser, function()
            loadBrowserURL(source, "http://mta/local/html/index.html")
        end)

        addEventHandler("onClientBrowserDocumentReady", webBrowser, function()
            isBrowserReady = true
            showCursor(true)
            isUIVisible = true
            -- Request data immediately
            triggerServerEvent("onRequestStatusUpdate", localPlayer)
        end)
    end
end

-- Bind F5
bindKey("f5", "down", toggleLinkingUI)

-- Events from UI
addEvent("onClientRequestNewCode", true)
addEventHandler("onClientRequestNewCode", root, function()
    triggerServerEvent("onRequestNewCode", localPlayer)
end)

addEvent("onClientRequestStatusUpdate", true)
addEventHandler("onClientRequestStatusUpdate", root, function()
    triggerServerEvent("onRequestStatusUpdate", localPlayer)
end)

-- Events from Server
addEvent("onReceiveNewCode", true)
addEventHandler("onReceiveNewCode", root, function(code)
    if isElement(webBrowser) and isBrowserReady then
        local safeCode = tostring(code):gsub("'", "\\'")
        executeBrowserJavascript(webBrowser, "updateUI({isLinked: false, code: '" .. safeCode .. "'})")
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
