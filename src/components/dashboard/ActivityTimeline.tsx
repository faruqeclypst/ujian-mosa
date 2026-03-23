import { motion } from "framer-motion";

import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import type { Loan } from "../../types/inventory";

interface ActivityTimelineProps {
  loans: Loan[];
}

const ActivityTimeline = ({ loans }: ActivityTimelineProps) => {
  const recentLoans = loans.slice(0, 5);

  return (
    <Card className="h-full">
      <CardHeader className="px-4 sm:px-6 pt-4 sm:pt-6">
        <CardTitle className="text-sm sm:text-base font-semibold">Aktivitas Peminjaman Terbaru</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 sm:space-y-6 px-4 sm:px-6 pb-4 sm:pb-6">
        {recentLoans.length === 0 ? (
          <p className="text-xs sm:text-sm text-muted-foreground">Belum ada riwayat peminjaman.</p>
        ) : (
          recentLoans.map((loan, index) => (
            <motion.div
              key={loan.id}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05, duration: 0.3 }}
              className="flex items-start gap-2 sm:gap-3"
            >
              <div className="mt-1 h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-primary flex-shrink-0" />
              <div className="flex-1 space-y-1 min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2">
                  <p className="text-xs sm:text-sm font-semibold truncate">{loan.borrowerName}</p>
                  <Badge variant={new Date(loan.returnDate) < new Date() ? "destructive" : "secondary"} className="text-xs self-start sm:self-auto">
                    {new Date(loan.loanDate).toLocaleDateString("id-ID", {
                      day: "2-digit",
                      month: "short",
                    })}
                  </Badge>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Meminjam <span className="font-medium text-foreground">{loan.itemName}</span> hingga {" "}
                  {new Date(loan.returnDate).toLocaleDateString("id-ID")}
                </p>
                {loan.notes ? <p className="text-xs text-muted-foreground break-words">Catatan: {loan.notes}</p> : null}
              </div>
            </motion.div>
          ))
        )}
      </CardContent>
    </Card>
  );
};

export default ActivityTimeline;
