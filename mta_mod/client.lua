
-- MTA:SA Account Link Mod - Client Side (Beautiful DX UI)
-- Author: AI Assistant

local screenW, screenH = guiGetScreenSize()
local isVisible = false
local currentCode = nil
local isHoveringCode = false
local linkStatus = "checking" -- "checking", "linked", "unlinked"
local discordInfo = nil -- { username, avatar, id }

-- UI Dimensions
local panelW, panelH = 500, 400
local panelX, panelY = (screenW - panelW) / 2, (screenH - panelH) / 2

-- Fonts
local fontMain = "default-bold"
local fontCode = "default-bold"

function drawUI()
    if not isVisible then return end
    
    -- Background Blur/Shadow
    dxDrawRectangle(panelX - 5, panelY - 5, panelW + 10, panelH + 10, tocolor(0, 0, 0, 150))
    dxDrawRectangle(panelX, panelY, panelW, panelH, tocolor(20, 20, 25, 245))
    
    -- Header
    dxDrawRectangle(panelX, panelY, panelW, 50, tocolor(0, 242, 234, 40))
    dxDrawText("VIXEL ROLEPLAY - نظام ربط الحساب", panelX + 20, panelY + 15, panelX + panelW, panelY + 50, tocolor(255, 255, 255, 255), 1.2, fontMain, "left", "top")
    
    -- Refresh Button (Top Right)
    local refreshX, refreshY = panelX + panelW - 100, panelY + 10
    local isHoverRefresh = isCursorOver(refreshX, refreshY, 80, 30)
    dxDrawRectangle(refreshX, refreshY, 80, 30, isHoverRefresh and tocolor(0, 242, 234, 100) or tocolor(255, 255, 255, 20))
    dxDrawText("تحديث", refreshX, refreshY, refreshX + 80, refreshY + 30, tocolor(255, 255, 255, 255), 1, fontMain, "center", "center")

    -- Link Status Indicator
    local statusColor = tocolor(255, 255, 255, 200)
    local statusText = "جاري التحقق..."
    if linkStatus == "linked" then
        statusColor = tocolor(0, 255, 0, 255)
        statusText = "الحالة: مربوط بنجاح"
    elseif linkStatus == "unlinked" then
        statusColor = tocolor(255, 0, 0, 255)
        statusText = "الحالة: غير مربوط"
    end
    dxDrawText(statusText, panelX + 20, panelY + 60, panelX + panelW, panelY + 80, statusColor, 1, fontMain, "left", "top")

    -- Content based on status
    if linkStatus == "linked" and discordInfo then
        -- Show Discord Info
        local avatarSize = 80
        local avatarX, avatarY = panelX + (panelW - avatarSize) / 2, panelY + 100
        dxDrawRectangle(avatarX - 2, avatarY - 2, avatarSize + 4, avatarSize + 4, tocolor(0, 242, 234, 100))
        -- Note: In real MTA, you'd use dxCreateTexture for the avatar URL
        dxDrawRectangle(avatarX, avatarY, avatarSize, avatarSize, tocolor(0, 0, 0, 150)) 
        dxDrawText("صورة الحساب", avatarX, avatarY, avatarX + avatarSize, avatarY + avatarSize, tocolor(255, 255, 255, 100), 0.8, fontMain, "center", "center")
        
        dxDrawText(discordInfo.username, panelX, panelY + 190, panelX + panelW, panelY + 220, tocolor(255, 255, 255, 255), 1.5, fontMain, "center", "top")
        dxDrawText("Discord ID: " .. discordInfo.id, panelX, panelY + 225, panelX + panelW, panelY + 245, tocolor(150, 150, 150, 255), 1, fontMain, "center", "top")
        
        -- Unlink Button
        local unlinkX, unlinkY = panelX + (panelW - 150) / 2, panelY + 280
        local isHoverUnlink = isCursorOver(unlinkX, unlinkY, 150, 40)
        dxDrawRectangle(unlinkX, unlinkY, 150, 40, isHoverUnlink and tocolor(255, 0, 0, 150) or tocolor(255, 0, 0, 100))
        dxDrawText("إلغاء الربط", unlinkX, unlinkY, unlinkX + 150, unlinkY + 40, tocolor(255, 255, 255, 255), 1.1, fontMain, "center", "center")
        
    elseif linkStatus == "unlinked" then
        if currentCode then
            dxDrawText("كود الربط الخاص بك جاهز:", panelX, panelY + 100, panelX + panelW, panelY + 130, tocolor(200, 200, 200, 255), 1.1, fontMain, "center", "top")
            
            -- Code Box
            local codeBoxW, codeBoxH = 400, 60
            local codeBoxX, codeBoxY = panelX + (panelW - codeBoxW) / 2, panelY + 140
            isHoveringCode = isCursorOver(codeBoxX, codeBoxY, codeBoxW, codeBoxH)
            
            dxDrawRectangle(codeBoxX, codeBoxY, codeBoxW, codeBoxH, tocolor(0, 0, 0, 100))
            dxDrawRectangle(codeBoxX, codeBoxY, codeBoxW, codeBoxH, tocolor(0, 242, 234, 20), false)
            
            if isHoveringCode then
                dxDrawText(currentCode, codeBoxX, codeBoxY, codeBoxX + codeBoxW, codeBoxY + codeBoxH, tocolor(0, 242, 234, 255), 1.5, fontCode, "center", "center")
                dxDrawText("(اضغط للنسخ)", codeBoxX, codeBoxY + codeBoxH + 5, codeBoxX + codeBoxW, codeBoxY + codeBoxH + 25, tocolor(0, 242, 234, 150), 0.9, fontMain, "center", "top")
            else
                dxDrawText("************************", codeBoxX, codeBoxY, codeBoxX + codeBoxW, codeBoxY + codeBoxH, tocolor(255, 255, 255, 100), 1.5, fontCode, "center", "center")
                dxDrawRectangle(codeBoxX + 10, codeBoxY + 10, codeBoxW - 20, codeBoxH - 20, tocolor(255, 255, 255, 20))
                dxDrawText("ضع الماوس لرؤية الكود", codeBoxX, codeBoxY, codeBoxX + codeBoxW, codeBoxY + codeBoxH, tocolor(255, 255, 255, 150), 1, fontMain, "center", "center")
            end
        else
            dxDrawText("اضغط على الزر أدناه لتوليد كود الربط", panelX, panelY + 150, panelX + panelW, panelY + 180, tocolor(200, 200, 200, 255), 1.1, fontMain, "center", "top")
            
            -- Generate Button
            local genX, genY = panelX + (panelW - 200) / 2, panelY + 200
            local isHoverGen = isCursorOver(genX, genY, 200, 50)
            dxDrawRectangle(genX, genY, 200, 50, isHoverGen and tocolor(0, 242, 234, 150) or tocolor(0, 242, 234, 100))
            dxDrawText("توليد الكود", genX, genY, genX + 200, genY + 50, tocolor(255, 255, 255, 255), 1.2, fontMain, "center", "center")
        end
    end
    
    -- Footer Info
    dxDrawText("توجه للموقع لإتمام عملية الربط: vixel-rp.com", panelX, panelY + panelH - 40, panelX + panelW, panelY + panelH, tocolor(150, 150, 150, 200), 0.9, fontMain, "center", "center")
end
addEventHandler("onClientRender", root, drawUI)

function toggleLinkMenu()
    isVisible = not isVisible
    showCursor(isVisible)
    if isVisible then
        checkStatus()
    else
        currentCode = nil
    end
end
bindKey("f5", "down", toggleLinkMenu)

function checkStatus()
    linkStatus = "checking"
    triggerServerEvent("onServerCheckLinkStatus", localPlayer)
end

-- Handle Clicks
addEventHandler("onClientClick", root, function(button, state)
    if not isVisible or state ~= "down" then return end
    
    -- Refresh
    if isCursorOver(panelX + panelW - 100, panelY + 10, 80, 30) then
        checkStatus()
    end
    
    -- Unlink
    if linkStatus == "linked" and isCursorOver(panelX + (panelW - 150) / 2, panelY + 280, 150, 40) then
        triggerServerEvent("onServerRequestUnlink", localPlayer)
    end
    
    -- Generate
    if linkStatus == "unlinked" and not currentCode and isCursorOver(panelX + (panelW - 200) / 2, panelY + 200, 200, 50) then
        triggerServerEvent("onServerRequestLinkCode", localPlayer)
    end
    
    -- Copy Code
    if currentCode and isHoveringCode and button == "left" then
        setClipboard(currentCode)
        outputChatBox("#00f2ea[Vixel] #ffffffتم نسخ الكود بنجاح!", 255, 255, 255, true)
    end
end)

-- Events from Server
addEvent("onClientReceiveLinkCode", true)
addEventHandler("onClientReceiveLinkCode", root, function(code)
    currentCode = code
end)

addEvent("onClientReceiveLinkStatus", true)
addEventHandler("onClientReceiveLinkStatus", root, function(status, info)
    linkStatus = status -- "linked" or "unlinked"
    discordInfo = info
end)

-- Helper: Check if cursor is over area
function isCursorOver(x, y, w, h)
    if not isCursorShowing() then return false end
    local mx, my = getCursorPosition()
    mx, my = mx * screenW, my * screenH
    return mx >= x and mx <= x + w and my >= y and my <= y + h
end
