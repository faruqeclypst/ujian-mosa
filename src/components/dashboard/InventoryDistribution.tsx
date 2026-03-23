import { motion } from "framer-motion";

import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { cn } from "../../lib/utils";
import type { InventoryItem, Room } from "../../types/inventory";

interface InventoryDistributionProps {
  items: InventoryItem[];
  rooms: Room[];
}

const barColors = ["bg-primary", "bg-accent", "bg-secondary", "bg-emerald-400", "bg-orange-400"];

const InventoryDistribution = ({ items, rooms }: InventoryDistributionProps) => {
  const totalsByRoom = rooms.map((room) => {
    const total = items
      .filter((item) => item.roomId === room.id)
      .reduce((sum, item) => sum + item.quantity, 0);
    return { room, total };
  });
  const grandTotal = totalsByRoom.reduce((sum, item) => sum + item.total, 0);

  return (
    <Card className="h-full">
      <CardHeader className="px-4 sm:px-6 pt-4 sm:pt-6">
        <CardTitle className="text-sm sm:text-base font-semibold">Sebaran Barang per Ruang</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 sm:space-y-4 px-4 sm:px-6 pb-4 sm:pb-6">
        {totalsByRoom.length === 0 ? (
          <p className="text-xs sm:text-sm text-muted-foreground">Belum ada data ruangan.</p>
        ) : (
          totalsByRoom.map((entry, index) => {
            const percentage = grandTotal === 0 ? 0 : Math.round((entry.total / grandTotal) * 100);
            return (
              <div key={entry.room.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs sm:text-sm font-medium truncate flex-1">{entry.room.name}</p>
                  <span className="text-xs text-muted-foreground ml-2 flex-shrink-0">{entry.total} unit</span>
                </div>
                <div className="h-1.5 sm:h-2 w-full rounded-full bg-muted">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    className={cn("h-1.5 sm:h-2 rounded-full", barColors[index % barColors.length])}
                  />
                </div>
                <p className="text-xs text-muted-foreground">{percentage}% dari total inventaris</p>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
};

export default InventoryDistribution;
