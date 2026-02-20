
-- MTA:SA Account Link Mod
-- Author: AI Assistant
-- Version: 1.0.0

local screenW, screenH = guiGetScreenSize()
local browser = nil
local isVisible = false

-- Config
local MOD_URL = "https://floridaroleplay.vercel.app/link-account" -- Your website URL
local TOGGLE_KEY = "f5"

function toggleLinkMenu()
    if not isVisible then
        -- Show
        if not browser then
            browser = guiCreateBrowser(0, 0, screenW, screenH, true, true, false)
            local theBrowser = guiGetBrowser(browser)
            
            addEventHandler("onClientBrowserCreated", theBrowser, function()
                loadBrowserURL(theBrowser, MOD_URL)
            end)
        end
        
        guiSetVisible(browser, true)
        showCursor(true)
        guiSetInputEnabled(true)
        isVisible = true
    else
        -- Hide
        guiSetVisible(browser, false)
        showCursor(false)
        guiSetInputEnabled(false)
        isVisible = false
    end
end
bindKey(TOGGLE_KEY, "down", toggleLinkMenu)

-- Handle messages from Browser (if needed)
addEventHandler("onClientBrowserWhitelistChange", root, function(urls)
    -- Whitelist your domain
end)
