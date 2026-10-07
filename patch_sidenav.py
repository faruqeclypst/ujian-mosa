import sys

with open('src/pages/superadmin/SuperAdminSettingsPage.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

old_nav = """  const sideNavItems: { key: Section; label: string; icon: typeof UserCircle }[] = [
    { key: "profile", label: "Profil Pribadi", icon: UserCircle },
    { key: "password", label: "Ganti Kata Sandi", icon: KeyRound },
    { key: "apk", label: "Versi APK Siswa", icon: Smartphone },
    { key: "media", label: "Penyimpanan Media", icon: Cloud },
  ];"""

new_nav = """  const sideNavItems: { key: Section; label: string; icon: any }[] = [
    { key: "profile", label: "Profil Pribadi", icon: UserCircle },
    { key: "password", label: "Ganti Kata Sandi", icon: KeyRound },
    { key: "bank", label: "Rekening Bank", icon: Landmark },
    { key: "apk", label: "Versi APK Siswa", icon: Smartphone },
    { key: "media", label: "Penyimpanan Media", icon: Cloud },
  ];"""

code = code.replace(old_nav, new_nav)

with open('src/pages/superadmin/SuperAdminSettingsPage.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
