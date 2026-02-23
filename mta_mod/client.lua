local sx, sy = guiGetScreenSize()
local browser = nil
local isUIVisible = false

function renderLinkingUI()
    if isUIVisible and isElement(browser) then
        dxDrawImage(0, 0, sx, sy, browser, 0, 0, 0, tocolor(255, 255, 255, 255), true)
    end
end

function toggleLinkingUI()
    if isUIVisible then
        if isElement(browser) then destroyElement(browser) end
        removeEventHandler("onClientRender", root, renderLinkingUI)
        showCursor(false)
        isUIVisible = false
    else
        browser = createBrowser(sx, sy, true, true)
        if not browser then 
            outputChatBox("حدث خطأ في إنشاء المتصفح، تأكد من دعم جهازك للـ CEF", 255, 0, 0)
            return 
        end
        
        addEventHandler("onClientBrowserCreated", browser, function()
            loadBrowserURL(source, "http://mta/local/html/index.html")
            focusBrowser(source)
            addEventHandler("onClientRender", root, renderLinkingUI)
            showCursor(true)
            isUIVisible = true
            triggerServerEvent("onRequestStatusUpdate", localPlayer)
        end)
    end
end

-- Command to open UI
addCommandHandler("link", toggleLinkingUI)
bindKey("f9", "down", toggleLinkingUI)

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
    if isElement(browser) then
        executeBrowserJS(browser, "updateUI({isLinked: false, code: '"..code.."'})")
    end
end)

addEvent("onReceiveStatusUpdate", true)
addEventHandler("onReceiveStatusUpdate", root, function(data)
    if isElement(browser) then
        local json = toJSON(data)
        -- Remove brackets from toJSON output for JS
        json = string.sub(json, 2, #json - 1)
        executeBrowserJS(browser, "updateUI("..json..")")
    end
end)
