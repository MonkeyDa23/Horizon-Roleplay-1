# Nova Roleplay - دليل تشغيل النظام من الصفر

هذا الدليل يشرح كيفية تشغيل الموقع وبوت الديسكورد وربطهما مع سيرفر MTA الخاص بك.

## 1. المتطلبات الأساسية
*   حساب **Supabase** (لقاعدة بيانات الموقع والتحقق من الهوية).
*   حساب **Discord Developer Portal** (لإنشاء البوت).
*   سيرفر **MTA** مع قاعدة بيانات MySQL.
*   بيئة تشغيل **Node.js** مثبتة.

---

## 2. إعداد قاعدة بيانات الموقع (Supabase)
1.  قم بإنشاء مشروع جديد في Supabase.
2.  اذهب إلى **SQL Editor** وقم بتشغيل الكود الموجود في ملف `database_schema.ts` (الموجود في مجلد المشروع).
3.  اذهب إلى **Authentication -> Providers -> Discord**:
    *   قم بتفعيل Discord.
    *   انسخ `Callback URL` لاستخدامه في ديسكورد.
    *   ستحتاج لإدخال `Client ID` و `Client Secret` من لوحة مطوري ديسكورد (الخطوة التالية).

---

## 3. إعداد بوت الديسكورد
1.  اذهب إلى [Discord Developer Portal](https://discord.com/developers/applications).
2.  قم بإنشاء تطبيق جديد (New Application).
3.  اذهب إلى قسم **Bot**:
    *   قم بتفعيل **Privileged Gateway Intents**:
        *   `Presence Intent`
        *   `Server Members Intent` (مهم جداً للمزامنة).
        *   `Message Content Intent`.
    *   انسخ الـ **Token**.
4.  اذهب إلى قسم **OAuth2**:
    *   انسخ الـ **Client ID** والـ **Client Secret**.
    *   أضف الـ `Redirect URI` الذي حصلت عليه من Supabase.

---

## 4. إعداد الملفات المتعلقة بـ MTA (MySQL)
1.  استخدم ملف `MTA_DATABASE_SETUP.sql` لإنشاء الجداول المطلوبة في قاعدة بيانات MySQL الخاصة بسيرفر MTA.
2.  هذه الجداول تسمح للبوت بقراءة الأكواد وتأكيد عملية الربط.

---

## 5. إعداد المتغيرات البيئية (.env)

يجب إنشاء ملفات `.env` في المسارات التالية:

### الموقع (الخادم الرئيسي) - `./.env`
```env
VITE_SUPABASE_URL=رابط_سوبابيس
VITE_SUPABASE_ANON_KEY=المفتاح_العام
SUPABASE_SERVICE_ROLE_KEY=مفتاح_الخدمة_السري
DISCORD_BOT_API_URL=http://localhost:3001
DISCORD_BOT_API_KEY=نفس_المفتاح_السري_في_البوت
SIGNATURE_KEY=مفتاح_توقيع_عشوائي_مشترك
BOT_WEB_KEY=مفتاح_توقيع_آخر_مشترك
ENCRYPTION_KEY=مفتاح_تشفير_للـ_2FA
MTA_BOT_KEY=مفتاح_توقيع_خاص_بالمزامنة_مع_MTA
PORT=3000
```

### بوت الديسكورد - `./discord-bot/.env`
```env
DISCORD_TOKEN=توكن_البوت
DISCORD_CLIENT_ID=آيدي_البوت
DISCORD_GUILD_ID=آيدي_سيرفر_الديسكورد
DATABASE_URL=mysql://user:pass@host:3006/dbname
DISCORD_BOT_API_KEY=نفس_المفتاح_السري_في_الموقع
SIGNATURE_KEY=نفس_مفتاح_التوقيع_في_الموقع
PORT=3001
```

---

## 6. تشغيل النظام
1.  قم بتثبيت المكتبات:
    ```bash
    npm install
    cd discord-bot && npm install
    ```
2.  تشغيل الموقع والبوت معاً:
    يمكنك تشغيلهما في نافذتين تيرمينال مختلفتين:
    *   الموقع: `npm run dev` (المسار الرئيسي)
    *   البوت: `npm run dev` (داخل مجلد discord-bot)

---

## 7. الربط مع MTA (السكربت)
1.  ضع مجلد `mta_mod` داخل مجلد `resources` في سيرفر MTA الخاص بك.
2.  تأكد من تعديل المفتاح السري في ملف `server.lua` ليتطابق مع `MTA_BOT_KEY` الموجود في الموقع.
3.  قم بتشغيل السكربت في السيرفر.

---

## 8. ملاحظات أمنية هامة
*   تم تعطيل `trust proxy` في الخادم لضمان عدم تزييف عناوين IP.
*   يتم التحقق من توقيع (Signature) جميع الطلبات بين الموقع والبوت لضمان عدم تلاعب الأطراف الثالثة.
*   تأكد من تغيير جميع كلمات المرور الافتراضية في قاعدة البيانات.
