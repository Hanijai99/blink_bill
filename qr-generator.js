let items = JSON.parse(localStorage.getItem("bharat_inventory") || "[]");

function generateCode() {
  const name = document.getElementById('pname').value.trim();
  const stock = parseInt(document.getElementById('pstock').value) || 0;
  const price = parseFloat(document.getElementById('pprice').value) || 0;
  const gst = parseFloat(document.getElementById('pgst').value) || 0;
  let barcode = document.getElementById('pbarcode').value.trim();
  if (!barcode) barcode = "AUTO-" + Date.now();

  if (!name || price <= 0) {
    alert("Product name and price are required.");
    return;
  }

  // Add/Update product
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

  // Get code type
  const codeType = document.querySelector('input[name="codeType"]:checked').value;

  // Clear previous
  document.getElementById("generatedCode").innerHTML = "";

  // Generate selected code
  if (codeType === "qr") {
    document.getElementById("codeTitle").innerText = "Product QR Code";
    new QRCode(document.getElementById("generatedCode"), {
      text: JSON.stringify({name, barcode, price, gst}),
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
  alert(`${codeType.toUpperCase()} generated successfully! Please print it. 🎉`);
}

function printCode() {
  const pname = document.getElementById('pname').value.trim() || "Product";
  const generated = document.getElementById("generatedCode").innerHTML;

  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>${pname} - Code Print</title>
  <style>
    body { text-align:center; font-family:Arial, sans-serif; padding:30px; background:white; }
    h2 { color:#006400; }
    div { max-width:300px; margin:30px auto; display:block; }
    @media print { body { padding:0; margin:0; } }
  </style>
</head>
<body>
  <h2>${pname}</h2>
  <div>${generated}</div>
  <script>
    window.onload = function() { window.print(); setTimeout(() => window.close(), 1000); };
  </script>
</body>
</html>`);

  win.document.close();
}