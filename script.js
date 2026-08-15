// ================== BHARAT BILLING PRO – UPDATED SCRIPT.JS WITH NEW FEATURES ==================

const defaultItems = [
];

let items = [];
let lowStockAlertShown = false;
let cart = [];
let bills = JSON.parse(localStorage.getItem("bharat_bills") || "[]");

// Attempt to migrate any legacy string-based bills to structured objects
try { migrateBills(); } catch (e) { /* migrate function may be defined later; safe to ignore here */ }

let owner = localStorage.getItem("owner") || "Owner";
if (document.getElementById("owner")) {
  document.getElementById("owner").innerText = owner;
}

function loadInventory(refreshUI = true) {
  const saved = localStorage.getItem("bharat_inventory");
  if (saved && saved.trim() !== "" && saved !== "[]") {
    try {
      items = JSON.parse(saved);
      items.forEach(item => {
        if (!item.initialStock || item.initialStock <= 0) {
          item.initialStock = item.stock || 1;
        }
      });
    } catch (e) {
      console.error("Inventory data error. Using defaults...");
      items = defaultItems;
      saveInventory();
    }
  } else {
    items = defaultItems;  
    saveInventory();
  }

  if (refreshUI) {
    updateStockStatus();
    checkLowStockAlert();
    if (document.getElementById("search")?.value) showSuggest();
  }
}

function saveInventory() {
  localStorage.setItem("bharat_inventory", JSON.stringify(items));
}

loadInventory();

window.addEventListener('storage', (e) => {
  if (e.key === 'bharat_inventory') loadInventory();
});
window.addEventListener('focus', () => loadInventory());
window.addEventListener('load', () => { try { migrateBills(); } catch(e){}; checkLowStockAlert(); });

function checkLowStockAlert() {
  if (lowStockAlertShown || !items || items.length === 0) return;

  const lowStock = items.filter(i => {
    const baseStock = i.initialStock || i.stock;
    if (baseStock <= 0) return false;
    const perc = (i.stock / baseStock) * 100;
    return perc < 20 && i.stock > 0;
  });

  const midStock = items.filter(i => {
    const baseStock = i.initialStock || i.stock;
    if (baseStock <= 0) return false;
    const perc = (i.stock / baseStock) * 100;
    return perc >= 40 && perc <= 60;
  });

  let message = "";
  if (lowStock.length > 0) {
    message += "🚨 LOW STOCK ALERT ! 🚨\n\n";
    lowStock.forEach(i => {
      const baseStock = i.initialStock || i.stock;
      const perc = ((i.stock / baseStock) * 100).toFixed(0);
      message += `• ${i.name}: Only ${i.stock} left (${perc}%)\n`;
    });
    message += "\nPlease order stock urgently.\n\n";
  }

  if (midStock.length > 0) {
    message += "⚠️ Restock Soon:\n";
    midStock.forEach(i => {
      const baseStock = i.initialStock || i.stock;
      const perc = ((i.stock / baseStock) * 100).toFixed(0);
      message += `• ${i.name}: ${perc}% left (${i.stock})\n`;
    });
  }

  if (message) {
    lowStockAlertShown = true;
    setTimeout(() => {
      alert(message);
    }, 1000);
  }
}

function showSuggest() {
  let q = (document.getElementById("search")?.value || "").toLowerCase().trim();
  let s = document.getElementById("suggest");
  if (!s || !q) { 
    s.innerHTML = ""; 
    s.style.display = "none"; 
    return; 
  }

  let matches = items.filter(i => 
    i.name.toLowerCase().includes(q) || (i.barcode && i.barcode.includes(q))
  );

  s.innerHTML = "";
  matches.forEach(i => {
    let div = document.createElement("div");
    div.className = "suggest-item";
    div.innerHTML = `
      <strong>${i.name}</strong> - ₹${i.price} (${i.gst}%)
      <small style="color:${i.stock<20?'red':'green'}">Stock: ${i.stock}</small>
    `;
    div.onclick = () => {
      document.getElementById("name").value = i.name;
      document.getElementById("price").value = i.price;
      document.getElementById("gst").value = i.gst;
      document.getElementById("search").value = "";
      s.style.display = "none";
      document.getElementById("qty").focus();
    };
    s.appendChild(div);
  });

  s.style.display = matches.length ? "block" : "none";
}

function add() {
  let name = document.getElementById("name").value.trim();
  let qty = parseInt(document.getElementById("qty").value) || 1;
  let price = parseFloat(document.getElementById("price").value) || 0;
  let gst = parseFloat(document.getElementById("gst").value) || 0;

  if (!name || price <= 0) {
    alert("Name & Price mandatory!");
    return;
  }

  let product = items.find(i => i.name === name);
  if (product) {
    if (product.stock < qty) {
      alert(`Out of stock! Only ${product.stock} left`);
      return;
    }
    product.stock -= qty;
    saveInventory();
    checkLowStockAlert();
  }

  cart.push({name, qty, price, gst});

  document.getElementById("name").value = "";
  document.getElementById("qty").value = 1;
  document.getElementById("price").value = "";
  document.getElementById("gst").value = "";

  updateCart();
  calc();
  updateStockStatus();
  document.getElementById("search").focus();
}

function calc() {
  let sub = cart.reduce((a,b) => a + b.qty * b.price, 0);
  let disc = parseFloat(document.getElementById("discAmt")?.value || 0);
  let gstTotal = cart.reduce((a,b) => a + (b.qty * b.price * b.gst/100), 0);
  let final = sub - disc + gstTotal;

  document.getElementById("sub").innerText = sub.toFixed(2);
  document.getElementById("disc").innerText = disc.toFixed(2);
  document.getElementById("gstt").innerText = gstTotal.toFixed(2);
  document.getElementById("final").innerText = final.toFixed(2);
}

function updateStockStatus() {
  let status = document.getElementById("stockStatus");
  if (!status) return;

  if (items.length === 0) {
    status.innerHTML = `<span style="color:#ff5722;font-weight:bold;">No products in stock. Go to Manage Stock and add items.</span>`;
    return;
  }

  let low = items.filter(i => i.stock < 20 && i.stock > 0).length;
  let out = items.filter(i => i.stock === 0).length;
  if (out > 0) status.innerHTML = `<span style="color:red;font-weight:bold;">${out} items OUT OF STOCK!</span>`;
  else if (low > 0) status.innerHTML = `<span style="color:orange;font-weight:bold;">${low} items low stock!</span>`;
  else status.innerHTML = `<span style="color:green;font-weight:bold;">All good,Lets start billing ✅</span>`;
}

function save() {
  if (cart.length === 0) return alert("Add items first!");

  // Calculate numeric totals
  let subtotal = cart.reduce((a,b) => a + b.qty * b.price, 0);
  let discount = parseFloat(document.getElementById("discAmt")?.value || 0);
  let gstTotal = cart.reduce((a,b) => a + (b.qty * b.price * b.gst/100), 0);
  let finalTotal = subtotal - discount + gstTotal;

  if (discount > subtotal * 0.2) {
    if (!confirm(`Heavy discount detected! ₹${discount.toFixed(2)} (${((discount/subtotal)*100).toFixed(0)}%)\nDo you want to save this bill anyway?`)) {
      return;
    }
  }

  const paymentMode = prompt("Payment mode? (cash / online / upi)", "cash");
  const mode = paymentMode ? paymentMode.toLowerCase().trim() : "cash";
  const isOnline = ['online', 'upi'].includes(mode);

  // Build structured bill object
  const bill = {
    id: 'bill-' + Date.now(),
    name: document.getElementById("cname")?.value.trim() || "Walk-in",
    phone: document.getElementById("cphone")?.value.trim() || "",
    items: cart.map(i => ({ name: i.name, qty: i.qty, price: i.price, gst: i.gst })),
    subtotal: parseFloat(subtotal.toFixed(2)),
    discount: parseFloat(discount.toFixed(2)),
    gst: parseFloat(gstTotal.toFixed(2)),
    total: parseFloat(finalTotal.toFixed(2)),
    itemsCount: cart.length,
    date: new Date().toISOString(),
    paymentMode: isOnline ? "online" : "cash"
  };

  bills.push(bill);
  localStorage.setItem("bharat_bills", JSON.stringify(bills));

  alert(`Bill saved! 💚\nPayment: ${isOnline ? "Online/UPI" : "Cash"}`);

  cart = [];
  updateCart(); 
  calc(); 
  updateStockStatus();
}

// Migration helper: convert old string-based bills to new structured format
function migrateBills() {
  try {
    let raw = JSON.parse(localStorage.getItem('bharat_bills') || '[]');
    let changed = false;
    const migrated = raw.map(b => {
      if (b && b.items && Array.isArray(b.items)) return b; // already structured
      if (b && b.itemsList) {
        // parse itemsList like: "name (qty×₹price) | name2 (...)"
        const items = b.itemsList.split(' | ').map(s => {
          const namePart = s.split(' (')[0].trim();
          let qty = 1, price = 0, gst = 0;
          const qtyMatch = s.match(/\((\d+)×/);
          if (qtyMatch) qty = parseInt(qtyMatch[1]);
          const priceMatch = s.match(/₹([0-9.]+)/);
          if (priceMatch) price = parseFloat(priceMatch[1]);
          return { name: namePart, qty, price, gst };
        });
        changed = true;
        return {
          id: b.id || ('bill-' + Date.now()),
          name: b.name || 'Walk-in',
          phone: b.phone || '',
          items: items,
          subtotal: parseFloat((items.reduce((a,i)=>a+i.qty*i.price,0)).toFixed(2)),
          discount: parseFloat((parseFloat(b.discount||0)).toFixed(2)) || 0,
          gst: parseFloat((items.reduce((a,i)=>a + (i.qty*i.price*(i.gst||0)/100),0)).toFixed(2)) || 0,
          total: parseFloat(b.total) || parseFloat(b.amount) || 0,
          itemsCount: b.itemsCount || items.length,
          date: b.date || new Date().toISOString(),
          paymentMode: b.paymentMode || 'cash'
        };
      }
      return b;
    });
    if (changed) {
      localStorage.setItem('bharat_bills', JSON.stringify(migrated));
      bills = migrated;
    } else {
      bills = raw;
    }
  } catch (e) {
    console.error('Failed to migrate bills', e);
  }
}

// Import/Restore backup
function importData() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json';
  input.onchange = (ev) => {
    const file = ev.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data.inventory || !data.bills) return alert('Invalid backup file');
        if (!confirm('This will replace current inventory and bills. Proceed?')) return;
        localStorage.setItem('bharat_inventory', JSON.stringify(data.inventory));
        localStorage.setItem('bharat_bills', JSON.stringify(data.bills));
        localStorage.setItem('backupDate', data.backupDate || new Date().toLocaleString());
        alert('Backup restored. Reloading...');
        location.reload();
      } catch (err) {
        alert('Invalid JSON file');
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

function wa() {
  if (document.getElementById('list').children.length === 0) {
    alert("No items added!");
    return;
  }

  const shop = JSON.parse(localStorage.getItem("bharat_shop_details") || "{}");
  const shopName = shop.shopName || "Bharat Billing Pro";
  const shopPhone = shop.shopPhone || "";

  const cname = document.getElementById('cname').value.trim() || "Customer";
  const cphone = document.getElementById('cphone').value.trim();

  const sub = parseFloat(document.getElementById('sub').innerText) || 0;
  const disc = parseFloat(document.getElementById('disc').innerText) || 0;
  const gstt = parseFloat(document.getElementById('gstt').innerText) || 0;
  const final = parseFloat(document.getElementById('final').innerText) || 0;

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-IN');
  const timeStr = now.toLocaleTimeString('en-IN');

  let itemsList = '';
  const rows = document.getElementById('list').querySelectorAll('div');
  rows.forEach((row, index) => {
    const name = row.querySelector('.name').innerText;
    const qty = row.querySelector('.qty').innerText;
    const price = row.querySelector('.price').innerText;
    const amount = (parseFloat(qty) * parseFloat(price)).toFixed(2);
    itemsList += `${index+1}. ${name} x ${qty} = ₹${amount}\n`;
  });

  const message = 
`*${shopName} Bill*  
Date: ${dateStr} | Time: ${timeStr}

Customer: ${cname}
${cphone ? 'Phone: ' + cphone : ''}

Items:
${itemsList}

Subtotal: ₹${sub.toFixed(2)}
Discount: -₹${disc.toFixed(2)}
GST: ₹${gstt.toFixed(2)}
*Total: ₹${final.toFixed(2)}*
  
Thank you
  
! 💚  
Come again and have a great day! 🛒
  
Pay via UPI: ${shop.upiId || 'your-upi-id@upi'}  
Scan QR to pay`;

  let waUrl = `https://wa.me/${cphone ? cphone : ''}?text=${encodeURIComponent(message)}`;

  const upiQR = localStorage.getItem("upiQRUrl");
  if (upiQR) {
    alert("A QR image is available. Attach it manually in WhatsApp or use an upcoming update for automatic sharing.");
  }

  window.open(waUrl, '_blank');
}

function print() {
  const listDiv = document.getElementById('list');
  if (!listDiv) {
    alert("List container not found, check in list ");
    return;
  }

  const rows = listDiv.querySelectorAll('div.row');
  if (rows.length === 0) {
    alert("No items added! First add some items!");
    return;
  }

  const shop = JSON.parse(localStorage.getItem("bharat_shop_details") || "{}");
  const shopName = shop.shopName || "Bharat Billing Pro";
  const shopAddress = shop.shopAddress || "";
  const shopPhone = shop.shopPhone || "";
  const shopGST = shop.shopGST || "";
  const counterNo = shop.counterNo || "Main Counter";

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-IN');
  const timeStr = now.toLocaleTimeString('en-IN');

  let billNo = localStorage.getItem("lastBillNo") || 1000;
  billNo = parseInt(billNo) + 1;
  localStorage.setItem("lastBillNo", billNo);

  let itemsHtml = '';
  let subtotal = 0;
  let totalGst = 0;
  let totalCgst = 0;
  let totalSgst = 0;
  let grandTotal = 0;

  rows.forEach((row, index) => {
    const name = row.querySelector('.name')?.innerText || "Unknown";
    const qty = parseFloat(row.querySelector('.qty')?.innerText) || 0;
    const price = parseFloat(row.querySelector('.price')?.innerText) || 0;
    const gstPer = parseFloat(row.querySelector('.gst')?.innerText) || 0;

    const amount = qty * price;
    const gstAmt = amount * (gstPer / 100);
    const halfGst = gstAmt / 2;

    subtotal += amount;
    totalGst += gstAmt;
    totalCgst += halfGst;
    totalSgst += halfGst;

    itemsHtml += `
      <tr>
        <td>${index + 1}</td>
        <td>${name}</td>
        <td>${qty}</td>
        <td>₹${price.toFixed(2)}</td>
        <td>${gstPer}%</td>
        <td>₹${halfGst.toFixed(2)}</td>
        <td>₹${halfGst.toFixed(2)}</td>
        <td>₹${amount.toFixed(2)}</td>
      </tr>
    `;
  });

  const discAmt = parseFloat(document.getElementById('disc')?.innerText) || 0;
  grandTotal = subtotal - discAmt + totalGst;

  const printWindow = window.open('', '_blank');
  if (!printWindow) { alert('Popup blocked. Allow popups to print.'); return; }
  printWindow.document.write(`
    <html>
    <head>
      <title>Bill - ${billNo}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; font-size: 14px; }
        .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #000; padding: 8px; text-align: center; }
        th { background: #f0f0f0; }
        .total { font-weight: bold; font-size: 16px; text-align: right; }
        .thanks { text-align: center; margin-top: 30px; font-style: italic; }
      </style>
    </head>
    <body>
      <div class="header">
        <h2>${shopName}</h2>
        <p>${shopAddress}</p>
        <p>Phone: ${shopPhone} | GST: ${shopGST} | Counter: ${counterNo}</p>
        <p>Bill No: ${billNo} | Date: ${dateStr} | Time: ${timeStr}</p>
      </div>

      <table>
        <thead>
          <tr>
            <th>Sl.No</th>
            <th>Item</th>
            <th>Qty</th>
            <th>Rate</th>
            <th>GST%</th>
            <th>CGST</th>
            <th>SGST</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>${itemsHtml}</tbody>
      </table>

      <div class="total">
        <p>Subtotal: ₹${subtotal.toFixed(2)}</p>
        <p>Discount: -₹${discAmt.toFixed(2)}</p>
        <p>CGST Total: ₹${totalCgst.toFixed(2)}</p>
        <p>SGST Total: ₹${totalSgst.toFixed(2)}</p>
        <p>Total GST: ₹${totalGst.toFixed(2)}</p>
        <p style="font-size:18px;">Grand Total: ₹${grandTotal.toFixed(2)}</p>
      </div>

      <div class="thanks">
        <p>Thank You! Come Again!</p>
      </div>

      <script>
        window.onload = () => { window.print(); setTimeout(() => window.close(), 1000); };
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
}

function upi() { 
  let amt = document.getElementById("final").innerText;
  if(amt=="0.00") return alert("Add items first!");
  window.open(`upi.html?amt=${amt}`, "_blank");
}

function logout() {
  if (confirm("Logout?")) {
    location.href = "login.html";
  }
}

function toggleMode() {
  const isDark = document.body.classList.toggle("dark");
  localStorage.setItem("dark", isDark);

  const loader = document.getElementById("bharatLoader");
  if (loader) {
    loader.style.background = isDark ? "#1e1e1e" : "#fff3e0";
    loader.style.color = isDark ? "#ffffff" : "#333333";
  }
}

if(localStorage.getItem("dark")==="true") document.body.classList.add("dark");

function exportData() {
  const backup = {
    inventory: items,
    bills: bills,
    backupDate: new Date().toLocaleString('en-IN')
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], {type: "application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `BharatBilling_Backup_${new Date().toLocaleDateString('en-IN')}.json`;
  a.click();
  URL.revokeObjectURL(url);
  alert("Full backup downloaded! Saved securely. 💾");
}

function dailyClose() {
  const today = new Date().toDateString();
  const todayBills = bills.filter(b => new Date(b.date).toDateString() === today);

  if (todayBills.length === 0) return alert("No sales today.");

  const total = todayBills.reduce((s, b) => s + (parseFloat(b.total) || 0), 0);
  const cash = todayBills.filter(b => b.paymentMode === "cash").reduce((s, b) => s + (parseFloat(b.total) || 0), 0);
  const online = total - cash;

  let report = `*DAILY CLOSE REPORT*%0A%0A`;
  report += `Date: ${today}%0A`;
  report += `Total Sales: ₹${total.toFixed(2)}%0A`;
  report += `Cash: ₹${cash.toFixed(2)}%0A`;
  report += `Online/UPI: ₹${online.toFixed(2)}%0A`;
  report += `Bills: ${todayBills.length}%0A%0A`;
  report += `Have a strong finish to your day! 💪`;

  if (confirm(report + "%0A%0ASend via WhatsApp?")) {
    window.open(`https://api.whatsapp.com/send?phone=&text=${report}`);
  }
}

function generateCode() {
  const name = document.getElementById('pname').value.trim();
  const stock = parseInt(document.getElementById('pstock').value) || 0;
  const price = parseFloat(document.getElementById('pprice').value) || 0;
  const gst = parseFloat(document.getElementById('pgst').value) || 0;
  let barcode = document.getElementById('pbarcode').value.trim();
  
  if (!barcode) {
    barcode = "AUTO-" + Date.now();
  }

  if (!name || stock <= 0 || price <= 0) {
    alert("Product name, stock, and price are required.");
    return;
  }

  const i = items.findIndex(p => p.name.toLowerCase() === name.toLowerCase());
  if (i !== -1) {
    items[i].stock = stock;
    items[i].price = price;
    items[i].gst = gst;
    items[i].barcode = barcode;
    items[i].initialStock = items[i].initialStock || stock;
  } else {
    items.push({ name, stock, price, gst, barcode, initialStock: stock });
  }

  localStorage.setItem("bharat_inventory", JSON.stringify(items));

  const codeType = document.querySelector('input[name="codeType"]:checked').value;
  document.getElementById("generatedCode").innerHTML = "";

  if (codeType === "qr") {
    document.getElementById("codeTitle").innerText = "Product QR Code";
    new QRCode(document.getElementById("generatedCode"), {
      text: JSON.stringify({ name, barcode, price, gst }),
      width: 200,
      height: 200,
      colorDark: "#000000",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.H
    });
  } else {
    document.getElementById("codeTitle").innerText = "Product Barcode";
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.id = "generatedBarcode";
    document.getElementById("generatedCode").appendChild(svg);
    JsBarcode("#generatedBarcode", barcode, {
      format: "CODE128",
      lineColor: "#000",
      width: 2,
      height: 100,
      fontSize: 20,
      displayValue: true
    });
  }

  document.getElementById("codeSection").style.display = "block";
  alert(codeType.toUpperCase() + " generated successfully! Please print it. 🎉");
}

function printCode() {
  const pname = document.getElementById('pname').value.trim() || "Product";
  const generated = document.getElementById("generatedCode").innerHTML;
  const codeType = document.querySelector('input[name="codeType"]:checked').value;

  const win = window.open('', '_blank');
  const htmlContent = '<!DOCTYPE html><html><head><title>' + pname + ' - ' + codeType + '</title><style>body{text-align:center;font-family:Arial,sans-serif;padding:30px;background:white;}h2{color:#006400;margin:20px 0;}h3{color:#333;}div{max-width:400px;margin:30px auto;display:block;}svg{max-width:100%;}canvas{max-width:100%;}@media print{body{padding:0;margin:0;}.no-print{display:none;}}</style></head><body><h2>' + pname + '</h2><h3>Product ' + codeType.toUpperCase() + '</h3><div>' + generated + '</div></body></html>';
  
  win.document.write(htmlContent);
  win.document.close();
  
  setTimeout(() => {
    win.print();
  }, 500);
}

function downloadCode() {
  const pname = document.getElementById('pname').value.trim() || "Product";
  const codeType = document.querySelector('input[name="codeType"]:checked').value;
  const generatedDiv = document.getElementById("generatedCode");

  if (codeType === "qr") {
    const canvas = generatedDiv.querySelector("canvas");
    if (canvas) {
      const link = document.createElement('a');
      link.href = canvas.toDataURL("image/png");
      link.download = pname + '_QR_Code.png';
      link.click();
    }
  } else {
    const svg = generatedDiv.querySelector("svg");
    if (svg) {
      const serializer = new XMLSerializer();
      const svgString = serializer.serializeToString(svg);
      const blob = new Blob([svgString], { type: 'image/svg+xml' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = pname + '_Barcode.svg';
      link.click();
    }
  }
}

function generateDynamicUPIQR(amount) {
  const shop = JSON.parse(localStorage.getItem("bharat_shop_details") || "{}");
  const upiId = shop.upiId || "yourupi@upi";
  const shopName = shop.shopName || "Bharat Billing Pro";
  const transactionNote = "Bill Payment - Bharat Billing Pro";

  const upiLink = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(shopName)}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(transactionNote)}`;

  const qrContainer = document.createElement('div');
  qrContainer.id = 'dynamic-qr-temp';
  qrContainer.style.display = 'none';
  document.body.appendChild(qrContainer);

  new QRCode(qrContainer, {
    text: upiLink,
    width: 256,
    height: 256,
    colorDark: "#000000",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.H
  });

  setTimeout(() => {
    const canvas = qrContainer.querySelector('canvas');
    const qrBase64 = canvas.toDataURL('image/png');
    document.body.removeChild(qrContainer);

    sendWhatsAppWithQR(qrBase64);
  }, 500);
}

function sendWhatsAppWithQR(qrBase64) {
  alert("QR ready! Attach it in WhatsApp or save the image.");
}

function showTodayStats() {
  const today = new Date().toDateString();
  const todayBills = bills.filter(b => new Date(b.date).toDateString() === today);

  if (todayBills.length === 0) return alert("No sales today.");

  const total = todayBills.reduce((sum, b) => sum + (parseFloat(b.total) || 0), 0);
  const cash = todayBills.filter(b => b.paymentMode === "cash").reduce((s, b) => s + (parseFloat(b.total) || 0), 0);
  const online = total - cash;

  const ctx = document.createElement('canvas');
  ctx.id = 'todayChart';
  ctx.style.maxWidth = '500px';
  ctx.style.margin = '20px auto';

  const modal = document.createElement('div');
  modal.style.position = 'fixed';
  modal.style.top = '0';
  modal.style.left = '0';
  modal.style.width = '100%';
  modal.style.height = '100%';
  modal.style.background = 'rgba(0,0,0,0.7)';
  modal.style.display = 'flex';
  modal.style.alignItems = 'center';
  modal.style.justifyContent = 'center';
  modal.style.zIndex = '9999';

  const content = document.createElement('div');
  content.style.background = 'white';
  content.style.padding = '30px';
  content.style.borderRadius = '12px';
  content.style.maxWidth = '600px';
  content.innerHTML = `
    <h2 style="text-align:center;">📊 TODAY STATS 📊</h2>
    <p>Total Sales: ₹${total.toFixed(2)}</p>
    <p>Cash: ₹${cash.toFixed(2)}</p>
    <p>Online/UPI: ₹${online.toFixed(2)}</p>
    <p>Bills: ${todayBills.length}</p>
    <div id="chartContainer"></div>
    <button onclick="this.parentElement.parentElement.remove()" style="margin-top:20px; padding:10px 20px; background:#d32f2f; color:white; border:none; border-radius:8px;">Close</button>
  `;

  content.querySelector('#chartContainer').appendChild(ctx);
  modal.appendChild(content);
  document.body.appendChild(modal);

  new Chart(ctx, {
    type: 'pie',
    data: {
      labels: ['Cash', 'Online/UPI'],
      datasets: [{
        data: [cash, online],
        backgroundColor: ['#2196f3', '#4caf50']
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'top' } }
    }
  });
}

function downloadPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFontSize(18);
  doc.text("Bharat Billing Pro", 105, 20, { align: "center" });

  doc.setFontSize(12);
  doc.text("Bill No: " + (parseInt(localStorage.getItem("lastBillNo") || 0) + 1), 20, 40);
  doc.text("Date: " + new Date().toLocaleDateString(), 20, 50);

  let y = 70;
  cart.forEach(item => {
    doc.text(`${item.name} x ${item.qty} = ₹${(item.qty * item.price).toFixed(2)}`, 20, y);
    y += 10;
  });

  doc.text("Total: ₹" + document.getElementById('final').innerText, 20, y + 20);

  doc.save("bill.pdf");
}

function updateCart() {
  const listEl = document.getElementById("list");
  if (!listEl) return;
  listEl.innerHTML = "";
  
  if (cart.length === 0) {
    listEl.innerHTML = "<p>No items yet.</p>";
    return;
  }

  cart.forEach((item, i) => {
    const total = item.qty * item.price * (1 + item.gst / 100);
    const row = document.createElement("div");
    row.className = "row";
    
    row.innerHTML = `
      <span class="name"></span>
      <span class="qty">${item.qty}</span>
      <span class="price">${item.price}</span>
      <span class="gst">${item.gst}</span>
      <span>₹${total.toFixed(2)}</span>
      <button style="background:red;color:white;padding:5px 10px;border:none;border-radius:8px;">×</button>
    `;
    row.querySelector(".name").textContent = item.name;
    row.querySelector("button").onclick = () => {
      cart.splice(i, 1);
      updateCart();
      calc();
      updateStockStatus();
    };
    listEl.appendChild(row);
  });
}

updateCart();
calc();
updateStockStatus();
document.getElementById("search")?.focus();