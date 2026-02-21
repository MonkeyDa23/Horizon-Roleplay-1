local browser = nil
local isBrowserOpen = false

-- Create the browser instance when the resource starts
addEventHandler('onClientResourceStart', resourceRoot, function()
    local screenWidth, screenHeight = guiGetScreenSize()
    local width, height = 450, 600
    local x, y = (screenWidth - width) / 2, (screenHeight - height) / 2

    browser = guiCreateBrowser(x, y, width, height, true, false, false)
    guiSetVisible(browser, false)
    
    -- Load the local HTML file
    loadBrowserURL(browser, 'html/index.html')

    addEventHandler('onClientBrowserDocumentReady', browser, function()
        -- Tell the server we are ready to get the link status
        triggerServerEvent('onPlayerRequestLinkStatus', localPlayer)
    end)
end)

-- Toggle browser visibility on F5
function toggleBrowser(key)
    if key == 'f5' then
        if not isBrowserOpen then
            guiSetVisible(browser, true)
            showCursor(true)
            isBrowserOpen = true
            -- Refresh status every time player opens the browser
            triggerServerEvent('onPlayerRequestLinkStatus', localPlayer)
        else
            guiSetVisible(browser, false)
            showCursor(false)
            isBrowserOpen = false
        end
    end
end
bindKey('f5', 'down', toggleBrowser)

-- Function to send data to the HTML UI
function updateUI(state, data)
    if browser and guiGetVisible(browser) then
        local jsonData = toJSON({ state = state, data = data })
        executeBrowserJavascript(browser, 'window.dispatchEvent(new CustomEvent("mta.updateUI", { detail: ' .. jsonData .. ' }));')
    end
end
addEvent('onClientUpdateUIVisibility', true)
addEventHandler('onClientUpdateUIVisibility', root, updateUI)

-- Event handler for copying code to clipboard
addEvent('onClientCopyCode', true)
addEventHandler('onClientCopyCode', root, function(code)
    setClipboard(code)
    -- You can add a notification here if you want
    -- e.g., exports.notifications:showInfo('تم نسخ الكود بنجاح')
end)

-- Forward code generation request to server
addEvent('onClientRequestLinkCode', true)
addEventHandler('onClientRequestLinkCode', root, function()
    triggerServerEvent('onPlayerRequestNewLinkCode', localPlayer)
end)

-- Forward unlink request to server
addEvent('onClientRequestUnlink', true)
addEventHandler('onClientRequestUnlink', root, function()
    triggerServerEvent('onPlayerRequestUnlink', localPlayer)
end)

-- Clean up when resource stops
addEventHandler('onClientResourceStop', resourceRoot, function()
    if isElement(browser) then
        destroyElement(browser)
    end
    showCursor(false)
end)
