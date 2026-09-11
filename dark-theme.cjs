const fs = require('fs');

function makeDark(filePath) {
  if (!fs.existsSync(filePath)) return;
  let code = fs.readFileSync(filePath, 'utf8');

  const replacements = [
    // Backgrounds & Containers
    { from: /bg-white(?!\/)/g, to: 'bg-gray-800' },
    { from: /border-gray-100(?!\/)/g, to: 'border-gray-700/50' },
    
    { from: /bg-gray-100(?!\/)/g, to: 'bg-gray-900/60' },
    { from: /hover:bg-gray-200\/70/g, to: 'hover:bg-gray-800' },
    { from: /hover:bg-gray-200(?!\/)/g, to: 'hover:bg-gray-700' },
    { from: /hover:bg-gray-100(?!\/)/g, to: 'hover:bg-gray-800/60' },
    { from: /focus:bg-gray-200\/70/g, to: 'focus:bg-gray-900' },
    
    // Texts
    { from: /text-gray-900(?!\/)/g, to: 'text-white' },
    { from: /text-gray-800(?!\/)/g, to: 'text-gray-200' },
    { from: /text-gray-700(?!\/)/g, to: 'text-gray-300' },
    { from: /text-gray-600(?!\/)/g, to: 'text-gray-400' },
    { from: /text-gray-500(?!\/)/g, to: 'text-gray-400' },
    { from: /text-gray-400(?!\/)/g, to: 'text-gray-500' },
    { from: /text-gray-300(?!\/)/g, to: 'text-gray-600' },
    
    // Borders
    { from: /border-gray-200(?!\/)/g, to: 'border-gray-700' },
    { from: /border-gray-300(?!\/)/g, to: 'border-gray-600' },

    // Specific colors
    { from: /bg-gray-50(?!\/)/g, to: 'bg-gray-900/40' },
    { from: /bg-\[\#f2f2f2\]/g, to: 'bg-gray-950' },
    { from: /bg-\[\#e3e3e3\]/g, to: 'bg-black' },
    { from: /text-black(?!\/)/g, to: 'text-white' },
    
    // Tinted Backgrounds
    { from: /bg-blue-50(?!\/)/g, to: 'bg-blue-500/10' },
    { from: /bg-red-50(?!\/)/g, to: 'bg-red-500/10' },
    { from: /bg-emerald-50(?!\/)/g, to: 'bg-emerald-500/10' },
    { from: /bg-orange-50(?!\/)/g, to: 'bg-orange-500/10' },
    { from: /bg-indigo-50(?!\/)/g, to: 'bg-indigo-500/10' },
    { from: /bg-yellow-50(?!\/)/g, to: 'bg-yellow-500/10' },
    { from: /bg-blue-100(?!\/)/g, to: 'bg-blue-900/30' },
    { from: /bg-indigo-100(?!\/)/g, to: 'bg-indigo-900/30' },

    // Tinted Borders
    { from: /border-blue-200(?!\/)/g, to: 'border-blue-500/20' },
    { from: /border-red-200(?!\/)/g, to: 'border-red-500/20' },
    { from: /border-emerald-200(?!\/)/g, to: 'border-emerald-500/20' },
    { from: /border-orange-200(?!\/)/g, to: 'border-orange-500/20' },
    
    // Tinted Texts
    { from: /text-blue-600(?!\/)/g, to: 'text-blue-400' },
    { from: /text-blue-700(?!\/)/g, to: 'text-blue-300' },
    { from: /text-red-500(?!\/)/g, to: 'text-red-400' },
    { from: /text-red-600(?!\/)/g, to: 'text-red-400' },
    { from: /text-orange-500(?!\/)/g, to: 'text-orange-400' },
    { from: /text-emerald-500(?!\/)/g, to: 'text-emerald-400' },
    { from: /text-emerald-600(?!\/)/g, to: 'text-emerald-400' },
    { from: /text-indigo-600(?!\/)/g, to: 'text-indigo-400' },
    { from: /text-indigo-700(?!\/)/g, to: 'text-indigo-300' },
    { from: /text-yellow-600(?!\/)/g, to: 'text-yellow-400' },
  ];

  replacements.forEach(r => {
    code = code.replace(r.from, r.to);
  });

  // Fix active tab highlighting
  code = code.replace(/bg-gray-800 text-blue-400 shadow-sm/g, 'bg-gray-700 text-blue-400 shadow-md border border-gray-600');

  fs.writeFileSync(filePath, code);
  console.log(`Updated ${filePath}`);
}

makeDark('src/components/Editor.tsx');
makeDark('src/App.tsx');
makeDark('src/components/CustomSelect.tsx');
