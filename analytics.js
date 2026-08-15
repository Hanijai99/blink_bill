// analytics.js — client-only heuristic predictions for stock and customer analysis
// Works with localStorage.bharat_bills and localStorage.bharat_inventory and localStorage.bharat_users

(function(){
  function getBills() {
    try { return JSON.parse(localStorage.getItem('bharat_bills')||'[]'); }
    catch(e){ return []; }
  }
  function getInventory(){
    try { return JSON.parse(localStorage.getItem('bharat_inventory')||'[]'); }
    catch(e){ return []; }
  }
  function getUsers(){
    try { return JSON.parse(localStorage.getItem('bharat_users')||'[]'); }
    catch(e){ return []; }
  }

  function isPaidUser(username){
    const users = getUsers();
    const u = users.find(x=>x.user===username);
    if(!u) return false;
    if(u.plan && (u.plan==='paid' || u.plan==='pro')) return true;
    if(u.paidUntil){
      try { if(new Date(u.paidUntil) > new Date()) return true; } catch(e){}
    }
    return !!u.isPaid || false;
  }

  // collect item sales counts per day for the lookback period (in days)
  function buildItemDailySeries(days){
    const bills = getBills();
    const now = new Date();
    const start = new Date(now.getTime() - (days-1)*24*3600*1000);
    const dayMap = {}; // item -> { dateStr -> qty }

    for(const b of bills){
      let date = new Date(b.date || b.createdAt || Date.now());
      if(date < start) continue;
      const dateKey = date.toISOString().slice(0,10);
      const items = b.items || [];
      for(const it of items){
        const name = it.name || 'Unknown';
        const qty = parseFloat(it.qty) || 0;
        dayMap[name] = dayMap[name] || {};
        dayMap[name][dateKey] = (dayMap[name][dateKey] || 0) + qty;
      }
    }

    // convert to arrays with zero-fill for missing days
    const series = {};
    for(const name in dayMap){
      const arr = [];
      for(let i=0;i<days;i++){
        const d = new Date(start.getTime() + i*24*3600*1000);
        const k = d.toISOString().slice(0,10);
        arr.push(dayMap[name][k] || 0);
      }
      series[name] = arr;
    }
    return series;
  }

  // simple exponential smoothing forecast for next N days
  function expSmoothForecast(series, alpha=0.4, horizon=7){
    // series: array of historical daily demands
    if(!series || series.length===0) return Array(horizon).fill(0);
    let s = series[0];
    for(let i=1;i<series.length;i++) s = alpha*series[i] + (1-alpha)*s;
    // forecast constant for each of next horizon days = s
    return Array(horizon).fill(s);
  }

  // generate detailed stock prediction including per-day forecasts
  function generateStockReportDetailed(horizonDays=7, lookbackDays=30){
    const inv = getInventory();
    const series = buildItemDailySeries(lookbackDays);
    const report = [];
    for(const item of inv){
      const name = item.name;
      const stock = parseFloat(item.stock) || 0;
      const hist = series[name] || Array(lookbackDays).fill(0);
      const avgDaily = hist.reduce((a,b)=>a+b,0)/Math.max(1, lookbackDays);
      const forecastArr = expSmoothForecast(hist, 0.4, horizonDays).map(x=>parseFloat(x.toFixed(2)));
      const forecastTotal = forecastArr.reduce((a,b)=>a+b,0);
      const projectedStock = stock - forecastTotal;
      const safety = Math.max(Math.ceil(avgDaily*3), 1);
      const needsReorder = projectedStock < safety;
      const suggestedOrder = needsReorder ? Math.max( Math.ceil((avgDaily*horizonDays + safety) - stock), 0) : 0;
      report.push({
        name,
        stock,
        avgDaily: parseFloat(avgDaily.toFixed(2)),
        forecastArr,
        forecastNextDays: parseFloat(forecastTotal.toFixed(2)),
        projectedStock: parseFloat(projectedStock.toFixed(2)),
        safety,
        needsReorder,
        suggestedOrder
      });
    }
    report.sort((a,b)=> (b.needsReorder - a.needsReorder) || (a.projectedStock - b.projectedStock));
    return report;
  }

  // backward-compatible wrapper
  function generateStockReport(horizonDays=7, lookbackDays=30){
    return generateStockReportDetailed(horizonDays, lookbackDays).map(r=>({
      name: r.name,
      stock: r.stock,
      avgDaily: r.avgDaily,
      forecastNextDays: r.forecastNextDays,
      projectedStock: r.projectedStock,
      safety: r.safety,
      needsReorder: r.needsReorder,
      suggestedOrder: r.suggestedOrder
    }));
  }

  // analyze customer purchase behaviour for given phone; months = 1 for normal, 12 for paid
  function analyzeCustomer(phone, months=1){
    if(!phone) return {error:'No phone provided'};
    const allBills = getBills().filter(b=> (b.phone || b.cphone || b.customerPhone || '') === phone );
    if(allBills.length===0) return {phone, purchases:0, recentPurchases:[], productFreq:[]};

    const now = new Date();
    const start = new Date(now.getTime() - months*30*24*3600*1000);
    const filtered = allBills.filter(b=> new Date(b.date || b.createdAt || Date.now()) >= start).sort((a,b)=> new Date(a.date || a.createdAt) - new Date(b.date || b.createdAt));

    const purchases = filtered.length;
    const totals = filtered.map(b => parseFloat(b.total || b.amount || 0) || 0);
    const avgBasket = totals.reduce((a,b)=>a+b,0)/Math.max(1,totals.length);

    const dates = filtered.map(b => new Date(b.date || b.createdAt || Date.now())).sort((a,b)=>a-b);
    const intervals = [];
    for(let i=1;i<dates.length;i++) intervals.push( (dates[i]-dates[i-1])/ (24*3600*1000) );
    const avgInterval = intervals.length? (intervals.reduce((a,b)=>a+b,0)/intervals.length) : null;
    const lastPurchase = dates.length? dates[dates.length-1].toISOString().slice(0,10) : null;
    const predictedNext = avgInterval ? new Date(dates[dates.length-1].getTime() + avgInterval*24*3600*1000).toISOString().slice(0,10) : null;

    let churnRisk = 'low';
    if(avgInterval && dates.length){
      const recency = (now - dates[dates.length-1])/(24*3600*1000);
      if(recency > avgInterval*2) churnRisk = 'high';
      else if(recency > avgInterval*1.2) churnRisk = 'medium';
    }

    // recent purchases list (descending by date) with summary
    const recentPurchases = filtered.slice().reverse().slice(0,10).map(b => ({
      date: new Date(b.date || b.createdAt || Date.now()).toISOString().slice(0,10),
      total: parseFloat(b.total || b.amount || 0) || 0,
      itemsCount: b.items ? b.items.length : (b.itemsCount||0),
      items: (b.items||[]).map(it=>({name:it.name, qty:it.qty, price:it.price}))
    }));

    // product-level frequency across filtered bills
    const freqMap = {};
    for(const b of filtered){
      const its = b.items || [];
      for(const it of its){
        const n = it.name || 'Unknown';
        const q = parseFloat(it.qty) || 0;
        freqMap[n] = (freqMap[n] || 0) + q;
      }
    }
    const productFreq = Object.keys(freqMap).map(k=>({name:k, qty:freqMap[k]})).sort((a,b)=>b.qty-a.qty);

    return {phone, purchases, avgBasket: parseFloat(avgBasket.toFixed(2)), avgInterval: avgInterval?parseFloat(avgInterval.toFixed(1)):null, lastPurchase, predictedNext, churnRisk, recentPurchases, productFreq};
  }

  // small UI helper: show a simple modal (uses AI modal styles)
  function showModal(title, html){
    const modal = document.createElement('div');
    modal.className = 'ai-modal-overlay';
    modal.innerHTML = `
      <div class="ai-modal-card">
        <div class="ai-modal-header"><h3>${title}</h3><button class="ai-close">×</button></div>
        <div style="padding:12px;max-height:80vh;overflow:auto">${html}</div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('.ai-close').onclick = ()=> document.body.removeChild(modal);
  }

  // expose API
  window.BharatAI = {
    generateStockReport, analyzeCustomer, isPaidUser
  };

  // Notifications & scheduled checks
  function requestNotificationPermission(){
    if(!('Notification' in window)) return Promise.resolve(false);
    if(Notification.permission === 'granted') return Promise.resolve(true);
    return Notification.requestPermission().then(p => p === 'granted');
  }

  function runLowStockCheckAndNotify(){
    try{
      if(!('Notification' in window)) return;
      if(Notification.permission !== 'granted') return;
      const report = generateStockReportDetailed(7, 30);
      const needs = report.filter(r => r.needsReorder);
      if(!needs || needs.length === 0) return;
      // Avoid spamming: only one notification per day
      const last = localStorage.getItem('bharat_last_lowstock_notified') || '';
      const today = (new Date()).toISOString().slice(0,10);
      if(last === today) return;
      const top = needs.slice(0,4).map(i=>`${i.name} (need ${i.suggestedOrder})`).join(', ');
      const title = 'Low stock alert — Bharat Billing';
      const body = `${top}. Open dashboard for details.`;
      try{ new Notification(title, { body }); }catch(e){ console.warn('Notification failed', e); }
      localStorage.setItem('bharat_last_lowstock_notified', today);
    }catch(e){ console.error(e); }
  }

  function scheduleDailyLowStockCheck(){
    // run immediate check if permission
    requestNotificationPermission().then(granted => {
      if(granted) runLowStockCheckAndNotify();
    });
    // schedule every 24 hours while page is open
    try{
      const ms24 = 24*3600*1000;
      setInterval(runLowStockCheckAndNotify, ms24);
    }catch(e){ /* ignore */ }
  }

  // convenience: add a professional dashboard panel + modal with charts and customer analysis
  function ensureDashboardButton(){
    try{
      let container = document.getElementById('aiControls');
      if(!container){
        container = document.createElement('div');
        container.id='aiControls';
        container.style.position='fixed';
        container.style.right='18px';
        container.style.bottom='18px';
        container.style.zIndex=99998;
        document.body.appendChild(container);
      }

      const btn = document.createElement('button');
      btn.innerText = 'AI Analyze';
      btn.title = 'Stock & Customer Insights';
      btn.style.padding='12px 16px'; btn.style.background='#0d47a1'; btn.style.color='white'; btn.style.border='none'; btn.style.borderRadius='10px'; btn.style.boxShadow='0 6px 18px rgba(13,71,161,0.18)'; btn.style.fontWeight='600';

      btn.onclick = ()=>{
        // create a richer modal UI
        const modal = document.createElement('div');
        modal.className = 'ai-modal-overlay';
        modal.innerHTML = `
          <div class="ai-modal-card">
            <div class="ai-modal-header">
              <h3>AI Stock & Customer Insights</h3>
              <button class="ai-close">×</button>
            </div>
            <div class="ai-modal-body">
              <div class="ai-left">
                <div class="ai-controls">
                  <label>Horizon (days)</label>
                  <select id="aiHorizon"><option value="7">7</option><option value="30">30</option></select>
                  <label>Lookback (days)</label>
                  <input id="aiLookback" type="number" value="30" min="7" max="365" />
                  <button id="aiRun" class="btn-primary">Run Prediction</button>
                </div>

                <div class="ai-chart-wrap">
                  <canvas id="aiForecastChart" style="max-height:260px"></canvas>
                </div>

                <div id="aiReport" class="ai-report"></div>
              </div>

              <div class="ai-right">
                <h4>Customer Analysis</h4>
                <div class="ai-customer">
                  <input id="aiPhone" placeholder="Enter customer mobile number" />
                  <div style="font-size:0.9rem;color:#555;margin-top:6px">Owner: <strong id="aiOwnerName"></strong> — Plan: <span id="aiOwnerPlan">Standard</span></div>
                  <button id="aiCustAnalyze" class="btn-secondary">Analyze Customer</button>
                </div>

                <div id="aiCustomerResult" class="ai-customer-result"></div>

                <div style="margin-top:18px;">
                  <button id="aiExport" class="btn-outline">Export Report</button>
                </div>
              </div>
            </div>
          </div>
        `;

        document.body.appendChild(modal);


        // fill owner info
        const owner = localStorage.getItem('owner') || '';
        document.getElementById('aiOwnerName').innerText = owner || '—';
        document.getElementById('aiOwnerPlan').innerText = isPaidUser(owner)?'Paid':'Standard';

        // chart instance holder
        let chartInst = null;

        async function runPrediction(){
          const horizon = parseInt(document.getElementById('aiHorizon').value) || 7;
          const lookback = parseInt(document.getElementById('aiLookback').value) || 30;
          const report = generateStockReportDetailed(horizon, lookback);

          // top items for chart (by forecast amount)
          const top = report.slice(0,10);
          const labels = Array.from({length:horizon},(_,i)=>`Day ${i+1}`);
          const datasets = top.map((t,idx)=>({label:t.name,data:t.forecastArr.slice(0,horizon),borderColor: ['#1976d2','#388e3c','#f57c00','#7b1fa2','#c2185b','#0097a7','#ff7043','#5c6bc0','#8d6e63','#2e7d32'][idx%10],backgroundColor:'transparent',tension:0.3}));

          // render chart
          const ctx = document.getElementById('aiForecastChart').getContext('2d');
          if(chartInst) chartInst.destroy();
          chartInst = new Chart(ctx, {type:'line',data:{labels, datasets}, options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom'}}}});

          // populate report table
          let html = '<table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left;padding:8px;border-bottom:1px solid #eee">Item</th><th style="padding:8px;border-bottom:1px solid #eee">Stock</th><th style="padding:8px;border-bottom:1px solid #eee">Avg/Day</th><th style="padding:8px;border-bottom:1px solid #eee">Forecast('+horizon+'d)</th><th style="padding:8px;border-bottom:1px solid #eee">Projected</th><th style="padding:8px;border-bottom:1px solid #eee">Reorder?</th><th style="padding:8px;border-bottom:1px solid #eee">Suggest</th></tr></thead><tbody>';
          for(const r of report){
            html += `<tr><td style='padding:8px;border-top:1px solid #f6f7fa'>${r.name}</td><td style='padding:8px;border-top:1px solid #f6f7fa'>${r.stock}</td><td style='padding:8px;border-top:1px solid #f6f7fa'>${r.avgDaily}</td><td style='padding:8px;border-top:1px solid #f6f7fa'>${r.forecastNextDays}</td><td style='padding:8px;border-top:1px solid #f6f7fa'>${r.projectedStock}</td><td style='padding:8px;border-top:1px solid #f6f7fa'>${r.needsReorder?'<strong style="color:#c62828">YES</strong>':'No'}</td><td style='padding:8px;border-top:1px solid #f6f7fa'>${r.suggestedOrder}</td></tr>`;
          }
          html += '</tbody></table>';
          document.getElementById('aiReport').innerHTML = html;
        }

        document.getElementById('aiRun').onclick = runPrediction;

        // customer analysis
        document.getElementById('aiCustAnalyze').onclick = ()=>{
          const phone = document.getElementById('aiPhone').value.trim();
          if(!phone) return alert('Enter phone number');
          const owner = localStorage.getItem('owner')||'';
          const months = isPaidUser(owner)?12:1;
          const res = analyzeCustomer(phone, months);
          let html = '';
          if(res.error) {
            html = `<div class='ai-cust-error'>${res.error}</div>`;
            document.getElementById('aiCustomerResult').innerHTML = html;
            return;
          }
          if(res.purchases===0){
            html = `<div class='ai-cust-empty'>No purchases found for <strong>${phone}</strong> in last ${months} month(s).</div>`;
            document.getElementById('aiCustomerResult').innerHTML = html;
            return;
          }

          // Summary
          html += `<div class='ai-cust-summary'><div><strong>Purchases:</strong> ${res.purchases}</div><div><strong>Avg basket:</strong> ₹${res.avgBasket}</div><div><strong>Avg interval:</strong> ${res.avgInterval?res.avgInterval+' days':'N/A'}</div><div><strong>Last purchase:</strong> ${res.lastPurchase || 'N/A'}</div><div><strong>Predicted next:</strong> ${res.predictedNext || 'N/A'}</div><div><strong>Churn risk:</strong> ${res.churnRisk}</div></div>`;

          // Recent purchases table
          html += `<h5 style="margin-top:12px">Recent Purchases</h5><div class='ai-recent-wrap'><table class='ai-recent-table'><thead><tr><th>Date</th><th>Total</th><th>Items</th><th>Preview</th></tr></thead><tbody>`;
          for(const p of res.recentPurchases){
            const itemsPreview = (p.items||[]).slice(0,4).map(it=>`${it.name} x${it.qty}`).join(', ');
            html += `<tr><td>${p.date}</td><td>₹${p.total.toFixed(2)}</td><td>${p.itemsCount}</td><td>${itemsPreview}${(p.items||[]).length>4?'...':''}</td></tr>`;
          }
          html += `</tbody></table></div>`;

          // Product frequency chart & table
          html += `<h5 style="margin-top:12px">Top Products (by qty)</h5><div class='ai-prod-wrap'><canvas id='aiCustChart' style='height:220px'></canvas><div class='ai-prod-list'><table class='ai-prod-table'><thead><tr><th>Product</th><th>Qty</th></tr></thead><tbody>`;
          const topProds = (res.productFreq || []).slice(0,10);
          for(const pr of topProds){ html += `<tr><td>${pr.name}</td><td>${pr.qty}</td></tr>`; }
          html += `</tbody></table></div></div>`;

          document.getElementById('aiCustomerResult').innerHTML = html;

          // render product bar chart
          try{
            const labels = topProds.map(p=>p.name);
            const data = topProds.map(p=>p.qty);
            const ctx = document.getElementById('aiCustChart').getContext('2d');
            if(window._aiCustChart) window._aiCustChart.destroy();
            window._aiCustChart = new Chart(ctx, { type: 'bar', data: { labels, datasets: [{ label: 'Qty', data, backgroundColor: '#1976d2' }] }, options: { indexAxis: 'y', responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}} } });
          }catch(e){ console.error(e); }
        };

        // export button
        document.getElementById('aiExport').onclick = ()=>{
          const horizon = parseInt(document.getElementById('aiHorizon').value)||7;
          const lookback = parseInt(document.getElementById('aiLookback').value)||30;
          const report = generateStockReportDetailed(horizon, lookback);
          const blob = new Blob([JSON.stringify({generatedAt:new Date().toISOString(),owner:localStorage.getItem('owner'),report},null,2)],{type:'application/json'});
          const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'bharat_ai_report_'+new Date().toISOString().slice(0,10)+'.json'; a.click(); URL.revokeObjectURL(a.href);
        };

        // close handler
        modal.querySelector('.ai-close').onclick = ()=> document.body.removeChild(modal);

        // initial run
        setTimeout(()=>document.getElementById('aiRun').click(),120);
      };

      container.appendChild(btn);
      // start scheduled daily low-stock checks (runs while dashboard page is open)
      try{ scheduleDailyLowStockCheck(); } catch(e){ console.warn('scheduling failed', e); }
    }catch(e){ console.error(e); }
  }

  // try to add button after DOM ready
  if(document.readyState === 'complete' || document.readyState === 'interactive') setTimeout(ensureDashboardButton,200);
  else window.addEventListener('DOMContentLoaded', ensureDashboardButton);
})();
