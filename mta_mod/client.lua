local browserGUI = nil
local browser = nil
local isBrowserOpen = false

-- Create browser when resource starts
addEventHandler("onClientResourceStart", resourceRoot, function()

    local screenWidth, screenHeight = guiGetScreenSize()
    local width, height = 450, 600
    local x, y = (screenWidth - width) / 2, (screenHeight - height) / 2

    -- Create GUI browser container
    browserGUI = guiCreateBrowser(x, y, width, height, true, false, true)

    if not browserGUI then
        outputDebugString("Failed to create browser. Make sure CEF is enabled.")
        return
    end

    -- Get actual CEF browser
    browser = guiGetBrowser(browserGUI)

    -- Wait until browser is created before loading page
    addEventHandler("onClientBrowserCreated", browser, function()
        local resourceName = getResourceName(getThisResource())
        local url = "http://mta/" .. resourceName .. "/html/index.html"
        loadBrowserURL(source, url)
    end)

    -- When page fully loads
    addEventHandler("onClientBrowserDocumentReady", browser, function()
        triggerServerEvent("onPlayerRequestLinkStatus", localPlayer)
    end)

    guiSetVisible(browserGUI, false)
end)

-- Toggle with F5
bindKey("F5", "down", function()

    if not browserGUI then return end

    if not isBrowserOpen then
        guiSetVisible(browserGUI, true)
        showCursor(true)
        isBrowserOpen = true

        -- Refresh link status every open
        triggerServerEvent("onPlayerRequestLinkStatus", localPlayer)
    else
        guiSetVisible(browserGUI, false)
        showCursor(false)
        isBrowserOpen = false
    end

end)

-- Close with ESC
bindKey("escape", "down", function()
    if isBrowserOpen then
        guiSetVisible(browserGUI, false)
        showCursor(false)
        isBrowserOpen = false
        cancelEvent()
    end
end)

-- Send data to HTML UI
function updateUI(state, data)
    if browser and isBrowserOpen then
        local jsonData = toJSON({ state = state, data = data })
        executeBrowserJavascript(
            browser,
            'window.dispatchEvent(new CustomEvent("mta.updateUI", { detail: ' .. jsonData .. ' }));'
        )
    end
end
addEvent("onClientUpdateUIVisibility", true)
addEventHandler("onClientUpdateUIVisibility", root, updateUI)

-- Copy code to clipboard
addEvent("onClientCopyCode", true)
addEventHandler("onClientCopyCode", root, function(code)
    setClipboard(code)
end)

-- Request new link code
addEvent("onClientRequestLinkCode", true)
addEventHandler("onClientRequestLinkCode", root, function()
    triggerServerEvent("onPlayerRequestNewLinkCode", localPlayer)
end)

-- Request unlink
addEvent("onClientRequestUnlink", true)
addEventHandler("onClientRequestUnlink", root, function()
    triggerServerEvent("onPlayerRequestUnlink", localPlayer)
end)

-- Cleanup
addEventHandler("onClientResourceStop", resourceRoot, function()
    if isElement(browserGUI) then
        destroyElement(browserGUI)
    end
    showCursor(false)
end)