export const dashboardHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Lucky100 Admin Dashboard</title>
    <script src="https://telegram.org/js/telegram-web-app.js"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-color: #0d1117;
            --glass-bg: rgba(255, 255, 255, 0.05);
            --glass-border: rgba(255, 255, 255, 0.1);
            --text-primary: #ffffff;
            --text-secondary: #8b949e;
            --accent: #58a6ff;
            --accent-hover: #3182ce;
            --accent-glow: rgba(88, 166, 255, 0.5);
            --success: #2ea043;
            --danger: #da3633;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            font-family: 'Inter', sans-serif;
        }

        body {
            background-color: var(--bg-color);
            background-image: 
                radial-gradient(circle at 15% 50%, rgba(88, 166, 255, 0.15) 0%, transparent 50%),
                radial-gradient(circle at 85% 30%, rgba(138, 43, 226, 0.15) 0%, transparent 50%);
            color: var(--text-primary);
            min-height: 100vh;
            padding: 20px;
            padding-bottom: 80px; /* Space for bottom tabs */
        }

        .glass {
            background: var(--glass-bg);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid var(--glass-border);
            border-radius: 16px;
            padding: 20px;
            box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.3);
            transition: transform 0.2s, box-shadow 0.2s;
            margin-bottom: 16px;
        }

        .header { text-align: center; margin-bottom: 24px; }
        .header h1 { font-size: 24px; font-weight: 700; background: linear-gradient(135deg, #fff, var(--accent)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .header p { color: var(--text-secondary); font-size: 14px; }

        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 16px; }
        .stat-value { font-size: 24px; font-weight: 700; margin: 8px 0; color: var(--accent); text-shadow: 0 0 10px var(--accent-glow); }
        .stat-label { font-size: 12px; text-transform: uppercase; color: var(--text-secondary); }

        .section { display: none; animation: fadeIn 0.3s; }
        .section.show { display: block; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }

        .tabs {
            position: fixed; bottom: 0; left: 0; right: 0;
            background: rgba(13, 17, 23, 0.85); backdrop-filter: blur(10px);
            display: flex; justify-content: space-around; padding: 12px 0;
            border-top: 1px solid var(--glass-border); z-index: 100;
        }
        .tab-btn {
            background: none; border: none; color: var(--text-secondary);
            font-size: 12px; display: flex; flex-direction: column; align-items: center; gap: 4px;
            cursor: pointer; transition: color 0.2s; width: 25%;
        }
        .tab-btn.active { color: var(--accent); }
        .tab-btn span { font-size: 20px; }

        .list-item {
            display: flex; flex-direction: column; padding: 12px 0;
            border-bottom: 1px solid var(--glass-border);
        }
        .list-item:last-child { border-bottom: none; }
        .list-row { display: flex; justify-content: space-between; align-items: center; width: 100%; margin-bottom: 8px; }

        .btn {
            padding: 6px 12px; border-radius: 8px; border: none; font-weight: 600; font-size: 12px;
            cursor: pointer; transition: opacity 0.2s; color: white;
        }
        .btn:hover { opacity: 0.8; }
        .btn-success { background: var(--success); }
        .btn-danger { background: var(--danger); }
        .btn-primary { background: var(--accent); padding: 10px 16px; font-size: 14px; width: 100%; margin-top: 10px; }

        input {
            width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--glass-border);
            background: rgba(0,0,0,0.2); color: white; margin-bottom: 12px;
        }
        label { display: block; font-size: 12px; color: var(--text-secondary); margin-bottom: 4px; }

        .loader { display: flex; justify-content: center; align-items: center; height: 200px; color: var(--accent); }
        .spinner { width: 40px; height: 40px; border: 4px solid var(--glass-border); border-top: 4px solid var(--accent); border-radius: 50%; animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
        
        #app { display: none; }
    </style>
</head>
<body>

    <div id="loader" class="loader"><div class="spinner"></div></div>

    <div id="app">
        <div class="header">
            <h1>Lucky100 Admin</h1>
            <p id="admin-name">Loading...</p>
        </div>

        <!-- OVERVIEW -->
        <div id="sec-overview" class="section show">
            <div class="grid" style="margin-bottom: 16px;">
                <div class="glass"><div class="stat-value" id="val-users">-</div><div class="stat-label">Users</div></div>
                <div class="glass"><div class="stat-value" id="val-balance">-</div><div class="stat-label">System Balance</div></div>
                <div class="glass"><div class="stat-value" id="val-tickets">-</div><div class="stat-label">Tickets Sold</div></div>
            </div>
            <div class="glass list-card">
                <div style="font-size: 16px; font-weight: 600; margin-bottom: 12px;">🎰 Active Round</div>
                <div id="round-info">Loading...</div>
            </div>
            
            <div class="glass list-card" style="margin-top: 16px;">
                <div style="font-size: 16px; font-weight: 600; margin-bottom: 12px;">🏆 Past Winners</div>
                <div id="past-rounds-list">Loading...</div>
            </div>
        </div>

        <!-- DEPOSITS -->
        <div id="sec-deposits" class="section">
            <h2 style="font-size:18px; margin-bottom: 12px;">Pending Deposits</h2>
            <div class="glass" id="deposits-list">Loading...</div>
        </div>

        <!-- WITHDRAWALS -->
        <div id="sec-withdrawals" class="section">
            <h2 style="font-size:18px; margin-bottom: 12px;">Pending Withdrawals</h2>
            <div class="glass" id="withdrawals-list">Loading...</div>
        </div>

        <!-- SETTINGS -->
        <div id="sec-settings" class="section">
            <h2 style="font-size:18px; margin-bottom: 12px;">System Configuration</h2>
            <div class="glass">
                <label>Default Ticket Price (ETB)</label>
                <input type="number" id="inp-price">
                <label>Default Max Tickets</label>
                <input type="number" id="inp-max">
                <label>Prize Percentage (%)</label>
                <input type="number" id="inp-prize">
                <label>Fee Percentage (%)</label>
                <input type="number" id="inp-fee">
                <button class="btn btn-primary" onclick="saveSettings()">Save Settings</button>
            </div>
            
            <h2 style="font-size:18px; margin-top:24px; margin-bottom:12px;">Admin Broadcast</h2>
            <div class="glass">
                <textarea id="inp-broadcast" rows="4" placeholder="Type message to all users here..." style="width:100%; border-radius:8px; background:rgba(0,0,0,0.2); color:white; border:1px solid var(--glass-border); padding:10px; margin-bottom:12px; font-family:inherit; resize:vertical;"></textarea>
                <button class="btn btn-primary" style="margin-top:0" onclick="sendBroadcast()">Broadcast Message</button>
            </div>
        </div>

        <!-- TABS -->
        <div class="tabs">
            <button class="tab-btn active" onclick="switchTab('overview', this)"><span>📊</span>Overview</button>
            <button class="tab-btn" onclick="switchTab('deposits', this)"><span>💳</span>Deposits <b id="badge-dep" style="color:var(--accent)"></b></button>
            <button class="tab-btn" onclick="switchTab('withdrawals', this)"><span>💸</span>Withdrawals <b id="badge-wit" style="color:var(--danger)"></b></button>
            <button class="tab-btn" onclick="switchTab('settings', this)"><span>⚙️</span>Settings</button>
        </div>
    </div>

    <script>
        const tg = window.Telegram.WebApp;
        tg.expand();
        tg.ready();

        if (tg.initDataUnsafe?.user) {
            document.getElementById('admin-name').innerText = \`Welcome, \${tg.initDataUnsafe.user.first_name}\`;
        }

        function switchTab(id, el) {
            document.querySelectorAll('.section').forEach(s => s.classList.remove('show'));
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.getElementById('sec-' + id).classList.add('show');
            el.classList.add('active');
        }

        let globalData = {};

        async function fetchDashboardData() {
            try {
                const response = await fetch('/api/admin/data', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ initData: tg.initData || '', userId: tg.initDataUnsafe?.user?.id })
                });

                if (!response.ok) throw new Error('Unauthorized.');
                const data = await response.json();
                globalData = data;
                
                // Pop Overview
                document.getElementById('val-users').innerText = data.totalUsers;
                document.getElementById('val-balance').innerText = data.totalBalance;
                document.getElementById('val-tickets').innerText = data.totalTickets;

                const rc = document.getElementById('round-info');
                if (data.activeRound) {
                    rc.innerHTML = \`<div class="list-row"><div><b>Round #\${data.activeRound.roundNumber}</b><br><small style="color:var(--text-secondary)">Tickets: \${data.activeRound.ticketsSold || 0} / \${data.activeRound.maxTickets}</small></div><span style="color:var(--success)">\${data.activeRound.status}</span></div>
                    <button class="btn btn-danger" style="margin-top: 10px; width: 100%" onclick="doAction('force_draw', 0)">Force Draw Early</button>\`;
                } else {
                    rc.innerHTML = \`<div style="color: var(--text-secondary); margin-bottom: 8px;">No active round.</div>
                                    <button class="btn btn-primary" onclick="doAction('start_round', 0)">Start New Round</button>\`;
                }

                const prList = document.getElementById('past-rounds-list');
                if (!data.pastRounds || data.pastRounds.length === 0) {
                    prList.innerHTML = '<small style="color:var(--text-secondary)">No completed rounds yet.</small>';
                } else {
                    prList.innerHTML = data.pastRounds.map(r => 
                        \`<div class="list-item">
                            <div class="list-row"><div><b>Round #\${r.roundNumber}</b><br><small style="color:var(--text-secondary)">Winning Ticket: <span style="color:var(--accent)">\${r.winnerTicket}</span></small></div>
                            <div style="font-size:12px; font-weight: 500">\${r.winnerName}</div></div>
                        </div>\`
                    ).join('');
                }

                // Pop Settings
                document.getElementById('inp-price').value = data.settings.defaultTicketPrice;
                document.getElementById('inp-max').value = data.settings.defaultMaxTickets;
                document.getElementById('inp-prize').value = data.settings.defaultPrizePercentage;
                document.getElementById('inp-fee').value = data.settings.defaultFeePercentage;

                // Pop Deposits
                const dList = document.getElementById('deposits-list');
                document.getElementById('badge-dep').innerText = data.pendingDeposits.length > 0 ? \`(\${data.pendingDeposits.length})\` : '';
                if(data.pendingDeposits.length === 0) dList.innerHTML = '<small style="color:var(--text-secondary)">No pending requests.</small>';
                else {
                    dList.innerHTML = data.pendingDeposits.map(d => 
                        \`<div class="list-item">
                            <div class="list-row"><div><b>\${d.amount} ETB</b><br><small style="color:var(--text-secondary)">User ID: \${d.userId}</small></div>
                            <div style="font-size:10px">ID:\${d.id}</div></div>
                            \${d.screenshotUrl ? \`<a href="\${d.screenshotUrl}" target="_blank"><img src="\${d.screenshotUrl}" style="max-height:100px; border-radius:8px; margin-bottom:8px; display:block" alt="Payment Proof" /></a>\` : '<small style="color:var(--danger); display:block; margin-bottom:8px">No screenshot.</small>'}
                            <div style="display:flex;gap:8px;margin-top:8px;">
                                <button class="btn btn-success" style="flex:1" onclick="doAction('approve_deposit',\${d.id})">Approve</button>
                                <button class="btn btn-danger" style="flex:1" onclick="doAction('reject_deposit',\${d.id})">Reject</button>
                            </div>
                        </div>\`
                    ).join('');
                }

                // Pop Withdrawals
                const wList = document.getElementById('withdrawals-list');
                document.getElementById('badge-wit').innerText = data.pendingWithdrawals.length > 0 ? \`(\${data.pendingWithdrawals.length})\` : '';
                if(data.pendingWithdrawals.length === 0) wList.innerHTML = '<small style="color:var(--text-secondary)">No pending requests.</small>';
                else {
                    wList.innerHTML = data.pendingWithdrawals.map(w => 
                        \`<div class="list-item">
                            <div class="list-row"><div><b>\${w.amount} ETB</b><br><small style="color:var(--accent)">\${w.address}</small></div></div>
                            <div style="font-size:10px; color:var(--text-secondary); margin-bottom:8px">User: \${w.userId}</div>
                            <div style="display:flex;gap:8px;">
                                <button class="btn btn-success" style="flex:1" onclick="doAction('approve_withdrawal',\${w.id})">Approve</button>
                                <button class="btn btn-danger" style="flex:1" onclick="doAction('reject_withdrawal',\${w.id})">Reject</button>
                            </div>
                        </div>\`
                    ).join('');
                }

                document.getElementById('loader').style.display = 'none';
                document.getElementById('app').style.display = 'block';

            } catch (error) {
                document.getElementById('loader').innerHTML = \`<div style="color: var(--danger);">Failed to load dashboard. Access Denied.</div>\`;
            }
        }

        async function doAction(action, id) {
            tg.showConfirm(\`Are you sure you want to \${action.replace('_', ' ')}?\`, async (confirmed) => {
                if(!confirmed) return;
                try {
                    const r = await fetch('/api/admin/action', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ initData: tg.initData || '', userId: tg.initDataUnsafe?.user?.id, action, id })
                    });
                    if(r.ok) {
                        tg.showAlert('Changes Applied!');
                        document.getElementById('app').style.display = 'none';
                        document.getElementById('loader').style.display = 'flex';
                        fetchDashboardData();
                    } else {
                        tg.showAlert('Failed to process.');
                    }
                } catch(e) { tg.showAlert('Error occurred.'); }
            });
        }

        async function saveSettings() {
            const payload = {
                defaultTicketPrice: document.getElementById('inp-price').value,
                defaultMaxTickets: document.getElementById('inp-max').value,
                defaultPrizePercentage: document.getElementById('inp-prize').value,
                defaultFeePercentage: document.getElementById('inp-fee').value
            };
            try {
                const r = await fetch('/api/admin/action', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ initData: tg.initData || '', userId: tg.initDataUnsafe?.user?.id, action: 'save_settings', payload })
                });
                if(r.ok) {
                    tg.showAlert('Settings correctly saved globally!');
                    fetchDashboardData();
                }
            } catch(e) { tg.showAlert('Error saving configuration.'); }
        }

        async function sendBroadcast() {
            const message = document.getElementById('inp-broadcast').value.trim();
            if(!message) return tg.showAlert('Message cannot be empty.');
            
            tg.showConfirm('Send this message to ALL verified users?', async (confirmed) => {
                if(!confirmed) return;
                try {
                    const r = await fetch('/api/admin/action', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ initData: tg.initData || '', userId: tg.initDataUnsafe?.user?.id, action: 'send_broadcast', payload: { message } })
                    });
                    if(r.ok) {
                        tg.showAlert('Broadcast correctly dispatched!');
                        document.getElementById('inp-broadcast').value = '';
                    } else tg.showAlert('Delivery failed.');
                } catch(e) { tg.showAlert('Networking error.'); }
            });
        }

        fetchDashboardData();
    </script>
</body>
</html>`;
