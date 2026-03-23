import * as React from "react";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  FileText,
  Home,
  Search,
  Settings,
  Users,
  CalendarCheck,
} from "lucide-react";

import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Badge } from "../ui/badge";

interface AppGuideProps {
  isOpen: boolean;
  onClose: () => void;
}

interface GuideSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  content: React.ReactNode;
}

const AppGuide: React.FC<AppGuideProps> = ({ isOpen, onClose }) => {
  const [currentSection, setCurrentSection] = React.useState<number>(0);

  const guideSections: GuideSection[] = [
    {
      id: "welcome",
      title: "Selamat Datang",
      icon: <Home className="h-5 w-5" />,
      content: (
        <div className="space-y-4">
          <div className="text-center mb-6">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <BookOpen className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Panduan Sistem Manajemen</h3>
            <p className="text-muted-foreground">
              Aplikasi komprehensif untuk mengelola data operasional sekolah secara real-time.
            </p>
          </div>

          <div className="grid gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Fitur Utama
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-primary rounded-full mt-2 flex-shrink-0" />
                    <span>Pengelolaan Data Master (Guru, Mapel, Kelas).</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-primary rounded-full mt-2 flex-shrink-0" />
                    <span>Import dan Export template massal via Microsoft Excel.</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      ),
    },
    {
      id: "master-data",
      title: "Manajemen Data Master",
      icon: <Users className="h-5 w-5" />,
      content: (
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">Kelola Guru, Kelas & Mapel</h4>
            <ul className="space-y-2 text-sm list-disc list-inside">
              <li>Mendaftarkan Guru beserta **Kode Guru** dan Mapel Utama.</li>
              <li>Mendaftarkan Kelas (Contoh: X MIPA 1, XI IPS 2).</li>
              <li>Mendaftarkan Mata Pelajaran yang diajarkan.</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-2">Cara Cepat / Import Massal</h4>
            <ol className="space-y-2 text-sm list-decimal list-inside">
              <li>Masuk ke menu data master (Misal: Data Guru).</li>
              <li>Klik tombol **Download Template** berkas Excel.</li>
              <li>Isi baris sesuai aturan lembar *Keterangan* pada Excel.</li>
              <li>Klik **Import** dan unggah berkas yang sudah diisi.</li>
            </ol>
          </div>
        </div>
      ),
    },
  ];

  const nextSection = () => {
    setCurrentSection((prev) => (prev + 1) % guideSections.length);
  };

  const prevSection = () => {
    setCurrentSection((prev) => (prev - 1 + guideSections.length) % guideSections.length);
  };

  const goToSection = (index: number) => {
    setCurrentSection(index);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Panduan Sistem Manajemen
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex">
          {/* Sidebar Navigation */}
          <div className="w-64 border-l flex-shrink-0 overflow-y-auto">
            <div className="p-4">
              <h3 className="font-semibold mb-3">Daftar Isi</h3>
              <div className="space-y-1">
                {guideSections.map((section, index) => (
                  <button
                    key={section.id}
                    onClick={() => goToSection(index)}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center gap-2 ${
                      currentSection === index
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    }`}
                  >
                    {section.icon}
                    {section.title}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center gap-2 mb-4">
                {guideSections[currentSection].icon}
                <h2 className="text-lg font-semibold">
                  {guideSections[currentSection].title}
                </h2>
              </div>

              <div className="prose prose-sm max-w-none">
                {guideSections[currentSection].content}
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Footer */}
        <div className="flex items-center justify-between p-4 border-t flex-shrink-0">
          <Button
            variant="outline"
            onClick={prevSection}
            disabled={currentSection === 0}
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Sebelumnya
          </Button>

          <div className="flex items-center gap-2">
            {guideSections.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSection(index)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  currentSection === index ? "bg-primary" : "bg-muted"
                }`}
              />
            ))}
          </div>

          <Button
            variant="outline"
            onClick={nextSection}
            disabled={currentSection === guideSections.length - 1}
          >
            Selanjutnya
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AppGuide;