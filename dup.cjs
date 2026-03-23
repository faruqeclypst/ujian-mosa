const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

const replacements = [
  { from: /InventoryItemForm/g, to: 'FixedAssetForm' },
  { from: /InventoryTable/g, to: 'FixedAssetTable' },
  { from: /InventoryPage/g, to: 'FixedAssetsPage' },
  { from: /InventoryItem/g, to: 'FixedAsset' },
  { from: /inventoryItemSchema/g, to: 'fixedAssetSchema' },
  { from: /inventoryExcelExport/g, to: 'fixedAssetExcelExport' },
  { from: /inventoryExcel/g, to: 'fixedAssetExcel' },
  { from: /exportInventoryToExcel/g, to: 'exportFixedAssetToExcel' },
  { from: /downloadInventoryImportTemplate/g, to: 'downloadFixedAssetImportTemplate' },
  { from: /parseInventoryImportExcel/g, to: 'parseFixedAssetImportExcel' },
  { from: /uploadInventoryImage/g, to: 'uploadFixedAssetImage' },
  { from: /data-inventaris\.xlsx/g, to: 'data-aset-tetap.xlsx' },
  { from: /inventory\/items/g, to: 'inventory/fixedAssets' },
  { from: /Barang Inventaris/g, to: 'Aset Tetap' },
  { from: /Inventaris Barang/g, to: 'Aset Tetap' },
  { from: /Barang/g, to: 'Aset Tetap' },
  { from: /barang/g, to: 'aset tetap' },
  { from: /Inventaris/g, to: 'Aset Tetap' },
  { from: /inventaris/g, to: 'aset tetap' },
  { from: /items/g, to: 'fixedAssets' }, // Only in certain files where we know it's safe! Let's be careful.
];

const filesToCopy = [
  {
    src: 'components/tables/InventoryTable.tsx',
    dest: 'components/tables/FixedAssetTable.tsx',
    replaceItems: false
  },
  {
    src: 'components/forms/InventoryItemForm.tsx',
    dest: 'components/forms/FixedAssetForm.tsx',
    replaceItems: false
  },
  {
    src: 'lib/inventoryExcel.ts',
    dest: 'lib/fixedAssetExcel.ts',
    replaceItems: true // items -> fixedAssets
  },
  {
    src: 'lib/inventoryExcelExport.ts',
    dest: 'lib/fixedAssetExcelExport.ts',
    replaceItems: true // items -> fixedAssets
  },
  {
    src: 'pages/InventoryPage.tsx',
    dest: 'pages/FixedAssetsPage.tsx',
    replaceItems: true // useInventory() returns items, we need fixedAssets
  }
];

filesToCopy.forEach(fileOpt => {
  const srcPath = path.join(srcDir, fileOpt.src);
  const destPath = path.join(srcDir, fileOpt.dest);
  
  if (!fs.existsSync(srcPath)) {
    console.log(`File ${srcPath} does not exist`);
    return;
  }
  
  let content = fs.readFileSync(srcPath, 'utf8');
  
  replacements.forEach(r => {
    if (r.from.toString() === '/items/g' && !fileOpt.replaceItems) return;
    content = content.replace(r.from, r.to);
  });
  
  // Specific fix for InventoryPage hooks and props
  if (fileOpt.src === 'pages/InventoryPage.tsx') {
    // We already replaced items -> fixedAssets, so:
    // const { fixedAssets, rooms, allRooms, createItem, updateItem, deleteItem } = useAset Tetap();
    // This is wrong, useInventory shouldn't become useAset Tetap.
    content = content.replace(/useAset Tetap/g, 'useInventory');
    content = content.replace(/FixedAssetTable fixedAssets=\{fixedAssets\}/g, 'FixedAssetTable items={fixedAssets}');
    content = content.replace(/createItem/g, 'createFixedAsset');
    content = content.replace(/updateItem/g, 'updateFixedAsset');
    content = content.replace(/deleteItem/g, 'deleteFixedAsset');
    content = content.replace(/FixedAsset\[\]/g, 'FixedAsset'); // in case of type FixedAsset[] -> FixedAsset
    content = content.replace(/FixedAssetFormValues/g, 'FixedAssetFormValues'); 
    content = content.replace(/import \{ uploadFixedAssetImage \} from "\.\.\/lib\/storage"/g, 'import { uploadFixedAssetImage } from "../lib/storage"');
    // Wait, storage.ts might not have uploadFixedAssetImage. I will check storage.ts later.
  }
  
  if (fileOpt.src === 'components/tables/InventoryTable.tsx') {
    // Props items: FixedAsset[] doesn't need to be items.
    // It's fine to leave it as items.
  }

  if (fileOpt.src === 'components/forms/InventoryItemForm.tsx') {
    content = content.replace(/FixedAssetFormValues/g, 'FixedAssetFormValues');
  }

  fs.writeFileSync(destPath, content);
  console.log(`Created ${destPath}`);
});
