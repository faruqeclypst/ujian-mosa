import sys

with open('src/pages/superadmin/SuperAdminSettingsPage.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

import_str = 'import { BankAccountsSettings } from "../../components/admin/BankAccountsSettings";'
if import_str not in code:
    code = code.replace('import { masterPb } from "../../lib/pocketbase";', 'import { masterPb } from "../../lib/pocketbase";\n' + import_str)

type_str = 'type Section = "profile" | "password" | "apk" | "media";'
new_type_str = 'type Section = "profile" | "password" | "apk" | "media" | "bank";'
code = code.replace(type_str, new_type_str)

import_icon_str = 'import { UserCircle, KeyRound, Save, CheckCircle, AlertCircle, Shield, Smartphone, Cloud, RefreshCw, Database, Server, Check } from "lucide-react";'
new_import_icon_str = 'import { UserCircle, KeyRound, Save, CheckCircle, AlertCircle, Shield, Smartphone, Cloud, RefreshCw, Database, Server, Check, Landmark } from "lucide-react";'
code = code.replace(import_icon_str, new_import_icon_str)

nav_items_old = """  const sideNavItems: { key: Section; label: string; icon: any }[] = [
    { key: "profile", label: "Profil Admin", icon: UserCircle },
    { key: "password", label: "Kata Sandi", icon: KeyRound },
    { key: "apk", label: "Versi APK Mobile", icon: Smartphone },
    { key: "media", label: "Cloud & Media", icon: Cloud },
  ];"""

nav_items_new = """  const sideNavItems: { key: Section; label: string; icon: any }[] = [
    { key: "profile", label: "Profil Admin", icon: UserCircle },
    { key: "password", label: "Kata Sandi", icon: KeyRound },
    { key: "bank", label: "Rekening Bank", icon: Landmark },
    { key: "apk", label: "Versi APK Mobile", icon: Smartphone },
    { key: "media", label: "Cloud & Media", icon: Cloud },
  ];"""

code = code.replace(nav_items_old, nav_items_new)

media_section_old = """          {/* Media & Cloud Storage Section */}
          {activeSection === "media" && ("""

bank_section_new = """          {/* Bank Accounts Section */}
          {activeSection === "bank" && (
             <BankAccountsSettings />
          )}

          {/* Media & Cloud Storage Section */}
          {activeSection === "media" && ("""

code = code.replace(media_section_old, bank_section_new)

with open('src/pages/superadmin/SuperAdminSettingsPage.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
