# 📱 راهنمای ساخت خروجی اندروید و اندروید تی‌وی (Android APK & Android TV)

پروژه **ai petros** (با نام تجاری پلتفرم **Aipetros-stream**) بر پایه معماری ماژولار Capacitor و سیستم ناوبری فضایی ریموت کنترل (Spatial D-Pad Remote) پیاده‌سازی شده است تا بر روی تمام گوشی‌ها، تبلت‌ها و تلویزیون‌های هوشمند مبتنی بر Android TV / Google TV به صورت بی‌نقص اجرا گردد.

---

## 🚀 مراحل ساخت خروجی APK و AAB

### ۱. نصب پیش‌نیازها
- ابزار Node.js (نسخه 18 یا بالاتر)
- نرم‌افزار Android Studio با Android SDK 33+ و Build Tools

### ۲. اضافه کردن بستر اندروید
```bash
npm run build
npx cap add android
```

### ۳. کپی پیکربندی اندروید تی‌وی (Android TV)
محتویات فایل `android/AndroidManifest-Leanback-Snippet.xml` را در فایل `android/app/src/main/AndroidManifest.xml` جای‌گذاری یا ادغام کنید. این کار به سیستم‌عامل اندروید اعلام می‌کند که برنامه از:
- قابلیت `android.software.leanback`
- ریموت کنترل D-Pad (کلیدهای جهت‌نما، Enter و Back)
- عدم نیاز اجباری به صفحه‌نمایش لمسی (`android.hardware.touchscreen=false`)
پشتیبانی کامل می‌نماید.

### ۴. بیلد نهایی در Android Studio
```bash
npx cap open android
```
سپس از منوی `Build` در Android Studio گزینه `Build Bundle(s) / APK(s) > Build APK(s)` را انتخاب نمایید.
فایل نصبی تولید شده در مسیر زیر قرار خواهد گرفت:
`android/app/build/outputs/apk/release/app-release.apk`

---

## 📺 قابلیت‌های ویژه اندروید تی‌وی
- **تشخیص خودکار ریموت کنترل:** به محض فشردن کلیدهای جهت‌نما، حالت فوکوس درخشان طلایی برای تلویزیون فعال می‌شود.
- **پیمایش سریع D-Pad:** کلیدهای بالا/پایین برای جابجایی بین ردیف‌های فیلم و چپ/راست برای جابجایی درون لیست.
- **کنترل پخش‌کننده با ریموت:** کلید Enter برای مکث/پخش و کلیدهای چپ/راست برای ۱۰ ثانیه جلو/عقب زدن ویدیو.
