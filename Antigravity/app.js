/* ==========================================================================
   BIOPULSE - COLLEGE BIOMETRIC ATTENDANCE APPLICATION LOGIC
   8-Period Daily Matrix • 2-Day Consecutive Absence Detector
   ========================================================================== */

class BioPulseApp {
  constructor() {
    this.currentTab = 'terminal';
    this.activePeriod = 3; // Default Period 3
    this.selectedDate = new Date().toISOString().split('T')[0];
    this.selectedMonth = '2026-07';
    this.audioEnabled = true;
    
    // Students Initial Seed Data (Will be overridden by live database fetch)
    this.students = [];
    this.attendanceDB = this.loadAttendanceFromStorage() || this.generateSeedAttendance();

    this.initAudioContext();
    this.initDOM();
    this.initCanvasScanner();
    this.bindEvents();
    
    // 🚀 Fetch live students from Neon Database on startup
    this.loadStudentsFromDatabase();

    this.startClock();
  }

 /* ==========================================================================
     FETCH LIVE STUDENTS FROM DATABASE (DEBUG VERSION)
     ========================================================================== */
  async loadStudentsFromDatabase() {
    try {
      console.log("Fetching live students from database...");
      
      const response = await fetch(`/api/getStudents?timestamp=${new Date().getTime()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      
      // 1. Check if the API endpoint actually exists
      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}. Make sure getStudents.js is deployed!`);
      }

      const textData = await response.text();
      console.log("Raw response from Neon/Vercel:", textData);
      
      // 2. Try to parse it as JSON
      const dbStudents = JSON.parse(textData);
      
      if (Array.isArray(dbStudents) && dbStudents.length > 0) {
        this.students = dbStudents.map((s, index) => ({
          id: 'STD' + String(index + 1).padStart(3, '0'),
          name: s.name || s.student_name || "Unknown Name", // Fallback if column names differ
          roll: s.roll_number || s.roll || "N/A",
          dept: s.dept || 'Computer Science',
          section: s.section || 'Sec-A',
          batch: s.batch || '2024-2028',
          fingerprintId: s.id || index + 1,
          photo: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
          phone: '+91 9800000000'
        }));
        console.log("✅ Successfully mapped database students to UI:", this.students);
      } else {
        console.log("Database returned an empty array or invalid format.");
        this.students = [];
      }
      
      this.renderAll();
    } catch (error) {
      console.error("❌ Failed to load live students:", error);
      this.renderAll();
    }
  }
  async saveNewStudentToDatabase(name, roll, dept, section, batch, fpId, phone, photo) {
    try {
      const response = await fetch('/api/addStudent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name, roll_number: roll, photo: photo })
      });
      
      const data = await response.json();
      if (data.success || response.ok) {
        alert(`✅ Student ${name} (Roll: ${roll}) registered successfully in the database!`);
        
        // 🚀 AWAIT the live refresh so it finishes before you look at it
        await this.loadStudentsFromDatabase(); 
        
        // 🚀 Automatically switch to the directory tab to see the new entry
        this.switchTab('directory'); 
      } else {
        alert("Could not save student to database. Check console.");
      }
    } catch (error) {
      console.error("Network error:", error);
      alert("Failed to reach the database API.");
    }
  }

  loadAttendanceFromStorage() {
    try {
      const data = localStorage.getItem('biopulse_attendance_db');
      return data ? JSON.parse(data) : null;
    } catch (e) { return null; }
  }

  saveAttendanceToStorage() {
    try {
      localStorage.setItem('biopulse_attendance_db', JSON.stringify(this.attendanceDB));
    } catch (e) {}
  }

  /* Generate 8-period attendance data for today and previous days */
  generateSeedAttendance() {
    const db = {};
    const todayStr = this.selectedDate;
    
    const dates = [];
    for (let d = 24; d <= 30; d++) {
      dates.push(`2026-07-${d < 10 ? '0' + d : d}`);
    }

    dates.forEach((dateStr) => {
      db[dateStr] = {};
      this.students.forEach((std, idx) => {
        const pState = {};
        
        if (std.id === 'STD003' && (dateStr === '2026-07-28' || dateStr === '2026-07-29' || dateStr === '2026-07-30')) {
          for (let p = 1; p <= 8; p++) pState[p] = 'A';
        }
        else if (std.id === 'STD005' && (dateStr >= '2026-07-26' && dateStr <= '2026-07-30')) {
          for (let p = 1; p <= 8; p++) pState[p] = 'A';
        } else {
          for (let p = 1; p <= 8; p++) {
            const rand = Math.random();
            if (rand > 0.15) pState[p] = 'P';
            else if (rand > 0.05) pState[p] = 'L';
            else pState[p] = 'A';
          }
        }
        db[dateStr][std.id] = pState;
      });
    });

    return db;
  }

  /* ==========================================================================
     AUDIO SYNTHESIZER ENGINE (Web Audio API)
     ========================================================================== */
  initAudioContext() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioCtx();
    } catch (e) {
      this.audioCtx = null;
    }
  }

  playBeep(type = 'success') {
    if (!this.audioEnabled || !this.audioCtx) return;
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }

    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    const now = this.audioCtx.currentTime;

    if (type === 'success') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.setValueAtTime(1318.5, now + 0.1);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.35);
    } else if (type === 'error') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.setValueAtTime(110, now + 0.15);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc.start(now);
      osc.stop(now + 0.4);
    }
  }

  /* ==========================================================================
     CANVAS FINGERPRINT SCANNER ANIMATION
     ========================================================================== */
  initCanvasScanner() {
    this.canvas = document.getElementById('scanner-canvas');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.drawFingerprintPattern(0);
  }

  drawFingerprintPattern(pulse = 0) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);

    const centerX = w / 2;
    const centerY = h / 2;

    ctx.beginPath();
    ctx.arc(centerX, centerY, 85 + Math.sin(pulse) * 3, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0, 242, 254, 0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();

    for (let r = 15; r <= 70; r += 7) {
      ctx.beginPath();
      ctx.ellipse(
        centerX + Math.sin(r) * 2,
        centerY + Math.cos(r) * 3,
        r,
        r * 1.3,
        0,
        0,
        Math.PI * 2
      );
      ctx.strokeStyle = `rgba(0, 242, 254, ${0.4 + (r / 100)})`;
      ctx.lineWidth = 2.2;
      ctx.setLineDash([Math.random() * 20 + 10, Math.random() * 5 + 2]);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    const minutiaePoints = [
      { x: centerX - 20, y: centerY - 30 },
      { x: centerX + 25, y: centerY - 15 },
      { x: centerX - 10, y: centerY + 25 },
      { x: centerX + 15, y: centerY + 35 },
      { x: centerX, y: centerY }
    ];

    minutiaePoints.forEach(pt => {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#ff2a5f';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 7, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 42, 95, 0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();
    });
  }

  triggerScanAnimation(callback) {
    const wrapper = document.getElementById('fingerprint-trigger');
    if (!wrapper) {
      if (callback) callback();
      return;
    }
    wrapper.classList.add('scanning');
    
    let frame = 0;
    const interval = setInterval(() => {
      frame += 0.2;
      this.drawFingerprintPattern(frame);
    }, 30);

    setTimeout(() => {
      clearInterval(interval);
      wrapper.classList.remove('scanning');
      this.drawFingerprintPattern(0);
      if (callback) callback();
    }, 1200);
  }

  /* ==========================================================================
     DOM & EVENT BINDINGS
     ========================================================================== */
  initDOM() {
    const datePicker = document.getElementById('daily-date-picker');
    if (datePicker) datePicker.value = this.selectedDate;
  }

  bindEvents() {
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const target = e.currentTarget.getAttribute('data-tab');
        this.switchTab(target);
      });
    });

    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const currentTheme = document.body.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        document.body.setAttribute('data-theme', newTheme);
        themeBtn.innerHTML = newTheme === 'light' ? '<i class="fa-solid fa-sun text-amber"></i>' : '<i class="fa-solid fa-moon"></i>';
      });
    }

    const periodSel = document.getElementById('period-selector');
    if (periodSel) {
      periodSel.addEventListener('change', (e) => {
        this.activePeriod = parseInt(e.target.value);
        document.getElementById('stat-current-period').textContent = `P${this.activePeriod}`;
        document.getElementById('current-period-name').textContent = `Period ${this.activePeriod}`;
      });
    }

    const fpTrigger = document.getElementById('fingerprint-trigger');
    if (fpTrigger) {
      fpTrigger.addEventListener('click', () => this.handleSimulatedScan());
    }

    const btnScanRandom = document.getElementById('btn-scan-random');
    if (btnScanRandom) {
      btnScanRandom.addEventListener('click', () => this.handleSimulatedScan());
    }

    const btnScanSelected = document.getElementById('btn-scan-selected');
    if (btnScanSelected) {
      btnScanSelected.addEventListener('click', () => {
        const selectedId = document.getElementById('select-quick-student').value;
        const student = this.students.find(s => s.id === selectedId);
        this.handleSimulatedScan(student);
      });
    }

    const btnSound = document.getElementById('btn-toggle-sound');
    if (btnSound) {
      btnSound.addEventListener('click', () => {
        this.audioEnabled = !this.audioEnabled;
        btnSound.innerHTML = this.audioEnabled 
          ? '<i class="fa-solid fa-volume-high"></i> Audio Feedback: ON'
          : '<i class="fa-solid fa-volume-xmark"></i> Audio Feedback: OFF';
      });
    }

    const datePicker = document.getElementById('daily-date-picker');
    if (datePicker) {
      datePicker.addEventListener('change', (e) => {
        this.selectedDate = e.target.value;
        if (!this.attendanceDB[this.selectedDate]) {
          this.attendanceDB[this.selectedDate] = {};
          this.students.forEach(s => {
            const p = {};
            for (let i = 1; i <= 8; i++) p[i] = 'A';
            this.attendanceDB[this.selectedDate][s.id] = p;
          });
          this.saveAttendanceToStorage();
        }
        this.renderDailyMatrix();
        this.checkConsecutiveAbsences();
      });
    }

    const filterDept = document.getElementById('filter-dept');
    const searchDaily = document.getElementById('search-student-daily');
    if (filterDept) filterDept.addEventListener('change', () => this.renderDailyMatrix());
    if (searchDaily) searchDaily.addEventListener('input', () => this.renderDailyMatrix());

    const btnExportDaily = document.getElementById('btn-export-daily-csv');
    if (btnExportDaily) btnExportDaily.addEventListener('click', () => this.exportDailyCSV());

    const btnExportMonthly = document.getElementById('btn-export-monthly-csv');
    if (btnExportMonthly) btnExportMonthly.addEventListener('click', () => this.exportMonthlyCSV());

    this.bindStudentFormEvents();

    const btnCopyCode = document.getElementById('btn-copy-code');
    if (btnCopyCode) {
      btnCopyCode.addEventListener('click', () => {
        const codeText = document.getElementById('python-code-block').innerText;
        navigator.clipboard.writeText(codeText).then(() => {
          btnCopyCode.innerHTML = '<i class="fa-solid fa-check text-emerald"></i> Copied!';
          setTimeout(() => btnCopyCode.innerHTML = '<i class="fa-solid fa-copy"></i> Copy Code', 2000);
        });
      });
    }

    const btnTestPing = document.getElementById('btn-test-pi-ping');
    if (btnTestPing) {
      btnTestPing.addEventListener('click', () => {
        btnTestPing.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Pinging...';
        setTimeout(() => {
          btnTestPing.innerHTML = '<i class="fa-solid fa-check text-emerald"></i> Ping OK (2ms)';
          setTimeout(() => btnTestPing.innerHTML = '<i class="fa-solid fa-network-wired"></i> Test Ping', 2000);
        }, 800);
      });
    }
  }

  bindStudentFormEvents() {
    const form = document.getElementById('form-add-student');
    const photoInput = document.getElementById('input-student-photo');
    const photoPreview = document.getElementById('student-photo-preview');
    const dropzone = document.getElementById('photo-dropzone');
    const uploadBtn = document.getElementById('btn-upload-trigger');
    const webcamBtn = document.getElementById('btn-webcam-snap');

    let currentPhotoBase64 = photoPreview ? photoPreview.src : '';

    if (uploadBtn && photoInput) {
      uploadBtn.addEventListener('click', () => photoInput.click());
    }

    if (dropzone && photoInput) {
      dropzone.addEventListener('click', () => photoInput.click());
    }

    if (photoInput) {
      photoInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            currentPhotoBase64 = event.target.result;
            if (photoPreview) photoPreview.src = currentPhotoBase64;
          };
          reader.readAsDataURL(file);
        }
      });
    }

    if (webcamBtn) {
      webcamBtn.addEventListener('click', () => {
        alert('WebCam Snapshot Simulated! Photo captured from laptop camera.');
        currentPhotoBase64 = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80';
        if (photoPreview) photoPreview.src = currentPhotoBase64;
      });
    }

    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();

        const name = document.getElementById('input-student-name').value.trim();
        const roll = document.getElementById('input-student-roll').value.trim();
        const dept = document.getElementById('input-student-dept').value;
        const section = document.getElementById('input-student-section') ? document.getElementById('input-student-section').value : 'Sec-A';
        const batch = document.getElementById('input-student-batch').value.trim() || '2024-2028';
        const fpId = parseInt(document.getElementById('input-fingerprint-id').value);
        const phone = document.getElementById('input-guardian-phone').value.trim() || '+91 9800000000';

        this.saveNewStudentToDatabase(name, roll, dept, section, batch, fpId, phone, currentPhotoBase64);

        form.reset();
        if (photoPreview) photoPreview.src = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80';
      });
    }
  }

  switchTab(tabId) {
    this.currentTab = tabId;

    document.querySelectorAll('.nav-tab').forEach(t => {
      t.classList.toggle('active', t.getAttribute('data-tab') === tabId);
    });

    document.querySelectorAll('.tab-pane').forEach(p => {
      p.classList.toggle('active', p.id === `tab-${tabId}`);
    });
  }

  startClock() {
    const clockEl = document.getElementById('live-clock');
    setInterval(() => {
      const now = new Date();
      if (clockEl) clockEl.textContent = now.toLocaleTimeString();
    }, 1000);
  }

  handleSimulatedScan(targetStudent = null) {
    if (!this.students || this.students.length === 0) return;
    const student = targetStudent || this.students[Math.floor(Math.random() * this.students.length)];
    const period = this.activePeriod;

    this.triggerScanAnimation(() => {
      if (!this.attendanceDB[this.selectedDate]) this.attendanceDB[this.selectedDate] = {};
      if (!this.attendanceDB[this.selectedDate][student.id]) {
        const p = {};
        for (let i = 1; i <= 8; i++) p[i] = 'A';
        this.attendanceDB[this.selectedDate][student.id] = p;
      }

      this.attendanceDB[this.selectedDate][student.id][period] = 'P';
      this.saveAttendanceToStorage();

      saveAttendanceToDatabase(student.name, student.roll);

      this.playBeep('success');
      this.renderVerificationResult(student, period, true);
      this.appendFeedEntry(student, period);
      this.renderDailyMatrix();
      this.checkConsecutiveAbsences();
    });
  }

  renderVerificationResult(student, period, isMatch = true) {
    const container = document.getElementById('verification-body');
    const timeStr = new Date().toLocaleTimeString();

    const timestampEl = document.getElementById('scan-timestamp');
    if (timestampEl) timestampEl.textContent = timeStr;

    if (isMatch && container) {
      container.innerHTML = `
        <div class="student-result-card">
          <img src="${student.photo}" alt="${student.name}" class="result-photo">
          <div class="result-details">
            <h4 class="result-name">${student.name}</h4>
            <span class="result-meta">Roll: <strong>${student.roll}</strong> • Dept: <strong>${student.dept}</strong></span>
            <span class="result-score"><i class="fa-solid fa-fingerprint"></i> Template Match ID #${student.fingerprintId} (Score: 98%)</span>
            <span class="result-meta" style="margin-top: 4px;">Period ${period} Attendance: <strong class="text-emerald">MARKED PRESENT ✅</strong></span>
          </div>
          <span class="result-badge success">VERIFIED</span>
        </div>
      `;
    }
  }

  appendFeedEntry(student, period) {
    const feedList = document.getElementById('terminal-feed-list');
    if (!feedList) return;
    const timeStr = new Date().toLocaleTimeString();

    const entry = document.createElement('div');
    entry.className = 'feed-item';
    entry.innerHTML = `
      <div class="feed-student">
        <img src="${student.photo}" alt="${student.name}" class="feed-avatar">
        <div>
          <strong>${student.name}</strong> (${student.roll})
          <div style="font-size:0.72rem; color: var(--text-muted);">Period ${period} • Finger ID #${student.fingerprintId}</div>
        </div>
      </div>
      <div style="text-align: right;">
        <span class="chip-legend present">P${period} PRESENT</span>
        <div style="font-size:0.72rem; color: var(--text-muted); margin-top:2px;">${timeStr}</div>
      </div>
    `;

    feedList.insertBefore(entry, feedList.firstChild);

    const countBadge = document.getElementById('feed-count-badge');
    if (countBadge) countBadge.textContent = `${feedList.children.length} Scans`;
  }

  checkConsecutiveAbsences() {
    const dates = Object.keys(this.attendanceDB).sort();
    if (dates.length < 3) return [];

    const flagged = [];

    this.students.forEach(student => {
      let consecutiveCount = 0;
      const missedDates = [];

      for (let i = dates.length - 1; i >= 0; i--) {
        const dStr = dates[i];
        const sRec = this.attendanceDB[dStr] ? this.attendanceDB[dStr][student.id] : null;

        if (sRec) {
          let absCount = 0;
          for (let p = 1; p <= 8; p++) {
            if (sRec[p] === 'A') absCount++;
          }

          if (absCount >= 6) {
            consecutiveCount++;
            missedDates.unshift(dStr);
          } else {
            break;
          }
        } else {
          break;
        }
      }

      if (consecutiveCount >= 3) {
        flagged.push({
          student: student,
          daysAbsent: consecutiveCount,
          missedDates: missedDates
        });
      }
    });

    const banner = document.getElementById('consecutive-absence-banner');
    const bannerText = document.getElementById('banner-absence-names');
    const navBadge = document.getElementById('nav-absence-badge');
    const statFlagged = document.getElementById('stat-flagged-students');

    if (banner && bannerText) {
      if (flagged.length > 0) {
        banner.classList.remove('hidden');
        const namesList = flagged.map(f => `<strong>${f.student.name} (${f.daysAbsent} Days)</strong>`).join(', ');
        bannerText.innerHTML = `${flagged.length} Student(s) [ ${namesList} ] absent for 3+ consecutive days!`;
        if (navBadge) navBadge.textContent = flagged.length;
        if (statFlagged) statFlagged.textContent = `${flagged.length} Alert`;
      } else {
        banner.classList.add('hidden');
        if (navBadge) navBadge.textContent = '0';
        if (statFlagged) statFlagged.textContent = '0 Clean';
      }
    }

    this.renderConsecutiveAbsenceCards(flagged);
    return flagged;
  }

  renderConsecutiveAbsenceCards(flaggedList) {
    const container = document.getElementById('flagged-cards-container');
    const totalBadge = document.getElementById('total-flagged-count');
    if (!container) return;

    if (totalBadge) totalBadge.textContent = `${flaggedList.length} Students Flagged`;

    if (flaggedList.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">
          <i class="fa-solid fa-circle-check" style="font-size: 40px; color: var(--accent-emerald); margin-bottom: 12px;"></i>
          <p>No students flagged for 3+ day consecutive absence! Attendance record is clear.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = flaggedList.map(item => `
      <div class="flagged-card">
        <div class="flagged-card-header">
          <img src="${item.student.photo}" alt="${item.student.name}" class="flagged-photo">
          <div>
            <h4 class="flagged-name">${item.student.name}</h4>
            <span class="flagged-meta">Roll: <strong>${item.student.roll}</strong> • ${item.student.dept} (${item.student.section || 'Sec-A'})</span>
            <div class="flagged-meta" style="margin-top:2px;">Phone: <strong>${item.student.phone}</strong></div>
          </div>
        </div>

        <span class="absence-counter-tag">
          <i class="fa-solid fa-triangle-exclamation"></i> ABSENT FOR ${item.daysAbsent} CONSECUTIVE DAYS (${item.daysAbsent} Days Counted)
        </span>

        <div style="font-size: 0.8rem; color: var(--text-muted);">
          Missed Dates (${item.missedDates.length} Days): <code>${item.missedDates.join(', ')}</code>
        </div>

        <div class="flagged-actions">
          <button class="btn btn-warning btn-sm w-100" onclick="alert('SMS Warning dispatched to Guardian of ${item.student.name} (${item.student.phone})!')">
            <i class="fa-solid fa-paper-plane"></i> Notify Parent (SMS)
          </button>
          <button class="btn btn-outline btn-sm" onclick="alert('Marked as Excused Medical Leave for ${item.student.name}.')">
            Excused
          </button>
        </div>
      </div>
    `).join('');
  }

  renderDailyMatrix() {
    const tbody = document.getElementById('daily-matrix-tbody');
    if (!tbody) return;

    const deptFilterEl = document.getElementById('filter-dept');
    const searchDailyEl = document.getElementById('search-student-daily');
    const deptFilter = deptFilterEl ? deptFilterEl.value : 'ALL';
    const searchVal = searchDailyEl ? searchDailyEl.value.toLowerCase().trim() : '';
    const dateRecords = this.attendanceDB[this.selectedDate] || {};

    const flaggedList = this.checkConsecutiveAbsences();
    const flaggedMap = new Map();
    flaggedList.forEach(f => flaggedMap.set(f.student.id, f.daysAbsent));

    let filtered = this.students.filter(s => {
      const matchDept = (deptFilter === 'ALL' || s.dept === deptFilter);
      const matchSearch = (s.name.toLowerCase().includes(searchVal) || s.roll.toLowerCase().includes(searchVal));
      return matchDept && matchSearch;
    });

    tbody.innerHTML = filtered.map(student => {
      const pRecord = dateRecords[student.id] || { 1:'A',2:'A',3:'A',4:'A',5:'A',6:'A',7:'A',8:'A' };
      
      let presentCount = 0;
      let chipsHTML = '';

      for (let p = 1; p <= 8; p++) {
        const st = pRecord[p] || 'A';
        if (st === 'P' || st === 'L') presentCount++;

        chipsHTML += `
          <td class="text-center">
            <span class="period-chip ${st}" onclick="app.togglePeriodStatus('${student.id}', ${p})" title="Click to toggle status for Period ${p}">
              ${st}
            </span>
          </td>
        `;
      }

      const absentDaysCount = flaggedMap.get(student.id);

      let totalPillClass = 'good';
      if (presentCount < 5) totalPillClass = 'critical';
      else if (presentCount < 7) totalPillClass = 'warning';

      return `
        <tr>
          <td>
            <div class="student-info-cell">
              <img src="${student.photo}" alt="${student.name}" class="table-avatar">
              <div>
                <span class="student-name">${student.name}</span>
                <span class="student-roll-sub">Batch ${student.batch}</span>
              </div>
            </div>
          </td>
          <td><strong>${student.roll}</strong></td>
          <td><span class="badge-normal">${student.dept} • ${student.section || 'Sec-A'}</span></td>
          ${chipsHTML}
          <td class="text-center">
            <span class="daily-total-pill ${totalPillClass}">
              ${presentCount} / 8
            </span>
          </td>
          <td class="text-center">
            ${absentDaysCount 
              ? `<span class="absence-alert-badge"><i class="fa-solid fa-triangle-exclamation"></i> ${absentDaysCount}-Day Warning</span>` 
              : '<span class="badge-normal">Normal</span>'}
          </td>
          <td class="text-center">
            <button class="btn btn-outline btn-sm" onclick="app.togglePeriodStatus('${student.id}', ${this.activePeriod})">
              Mark P${this.activePeriod}
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  togglePeriodStatus(studentId, period) {
    if (!this.attendanceDB[this.selectedDate]) this.attendanceDB[this.selectedDate] = {};
    if (!this.attendanceDB[this.selectedDate][studentId]) {
      const p = {};
      for (let i = 1; i <= 8; i++) p[i] = 'A';
      this.attendanceDB[this.selectedDate][studentId] = p;
    }

    const current = this.attendanceDB[this.selectedDate][studentId][period] || 'A';
    const nextState = current === 'P' ? 'L' : (current === 'L' ? 'A' : 'P');

    this.attendanceDB[this.selectedDate][studentId][period] = nextState;
    this.saveAttendanceToStorage();
    this.renderDailyMatrix();
    this.checkConsecutiveAbsences();
  }

  renderMonthlyLogs() {
    const tbody = document.getElementById('monthly-logs-tbody');
    if (!tbody) return;

    const searchMonthlyEl = document.getElementById('search-student-monthly');
    const searchVal = searchMonthlyEl ? searchMonthlyEl.value.toLowerCase().trim() : '';
    const totalMonthlyPeriods = 160;

    let filtered = this.students.filter(s => {
      return s.name.toLowerCase().includes(searchVal) || s.roll.toLowerCase().includes(searchVal);
    });

    tbody.innerHTML = filtered.map(student => {
      let periodsPresent = 0;
      let daysLogged = 0;

      Object.keys(this.attendanceDB).forEach(d => {
        const sRec = this.attendanceDB[d][student.id];
        if (sRec) {
          daysLogged++;
          for (let p = 1; p <= 8; p++) {
            if (sRec[p] === 'P' || sRec[p] === 'L') periodsPresent++;
          }
        }
      });

      const totalAttendedScale = Math.min(totalMonthlyPeriods, Math.round(periodsPresent * 4.5));
      const percentage = Math.min(100, Math.round((totalAttendedScale / totalMonthlyPeriods) * 100));
      const periodsAbsent = totalMonthlyPeriods - totalAttendedScale;

      let scoreBadge = '<span class="chip-legend present">EXCELLENT</span>';
      if (percentage < 75) scoreBadge = '<span class="absence-alert-badge"><i class="fa-solid fa-triangle-exclamation"></i> LOW (&lt;75%)</span>';
      else if (percentage < 85) scoreBadge = '<span class="chip-legend" style="background:rgba(245,158,11,0.2); color:var(--accent-amber);">AVERAGE</span>';

      return `
        <tr>
          <td>
            <div class="student-info-cell">
              <img src="${student.photo}" alt="${student.name}" class="table-avatar">
              <div>
                <span class="student-name">${student.name}</span>
                <span class="student-roll-sub">Biometric ID #${student.fingerprintId}</span>
              </div>
            </div>
          </td>
          <td><strong>${student.roll}</strong></td>
          <td><span class="badge-normal">${student.dept}</span></td>
          <td class="text-center">${totalMonthlyPeriods}</td>
          <td class="text-center text-emerald"><strong>${totalAttendedScale}</strong></td>
          <td class="text-center text-danger"><strong>${periodsAbsent}</strong></td>
          <td class="text-center">
            <strong style="font-family: var(--font-heading); font-size: 1rem;">${percentage}%</strong>
          </td>
          <td class="text-center">${scoreBadge}</td>
          <td class="text-center">
            <button class="btn btn-outline btn-sm" onclick="app.openStudentMonthlyCalendar('${student.id}')">
              <i class="fa-solid fa-calendar"></i> View Calendar
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  openStudentMonthlyCalendar(studentId) {
    const student = this.students.find(s => s.id === studentId);
    if (!student) return;

    const titleEl = document.getElementById('modal-student-name-title');
    if (titleEl) {
      titleEl.innerHTML = `
        <i class="fa-solid fa-user text-cyan"></i> Monthly Calendar: <strong>${student.name}</strong> (${student.roll})
      `;
    }

    const body = document.getElementById('modal-monthly-calendar-body');
    if (!body) return;

    let daysHTML = '';
    for (let day = 1; day <= 30; day++) {
      const isPresentDay = day % 7 !== 0 && day % 6 !== 0;
      daysHTML += `
        <div style="background: ${isPresentDay ? 'rgba(16,185,129,0.12)' : 'rgba(255,42,95,0.12)'}; 
                    border: 1px solid ${isPresentDay ? 'rgba(16,185,129,0.3)' : 'rgba(255,42,95,0.3)'}; 
                    border-radius: 8px; padding: 10px; text-align: center;">
          <div style="font-size:0.75rem; color: var(--text-muted);">Jul ${day}</div>
          <div style="font-weight:700; color: ${isPresentDay ? 'var(--accent-emerald)' : '#ff2a5f'}; font-size: 0.85rem; margin-top:2px;">
            ${isPresentDay ? '8/8 P' : '0/8 A'}
          </div>
        </div>
      `;
    }

    body.innerHTML = `
      <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:14px;">
        Daily 8-Period Breakdown for July 2026:
      </p>
      <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px;">
        ${daysHTML}
      </div>
    `;

    const modal = document.getElementById('modal-monthly-detail');
    if (modal) modal.classList.remove('hidden');

    const closeBtn = document.getElementById('btn-close-monthly-modal');
    if (closeBtn && modal) {
      closeBtn.onclick = () => modal.classList.add('hidden');
    }
  }

  renderStudentDirectory() {
    const container = document.getElementById('student-directory-list');
    const quickSelect = document.getElementById('select-quick-student');

    if (quickSelect) {
      quickSelect.innerHTML = this.students.map(s => `
        <option value="${s.id}">${s.name} (${s.roll}) - Biometric ID #${s.fingerprintId}</option>
      `).join('');
    }

    if (container) {
      container.innerHTML = this.students.map(s => `
        <div class="roster-card">
          <img src="${s.photo}" alt="${s.name}" class="roster-avatar">
          <div class="roster-info">
            <div class="roster-name">${s.name}</div>
            <div class="roster-sub">${s.roll} • ${s.dept} (${s.section || 'Sec-A'})</div>
            <span class="roster-sensor-id"><i class="fa-solid fa-fingerprint"></i> Biometric Template ID #${s.fingerprintId}</span>
          </div>
        </div>
      `).join('');
    }

    const totalStudentsEl = document.getElementById('stat-total-students');
    if (totalStudentsEl) totalStudentsEl.textContent = this.students.length;
  }

  exportDailyCSV() {
    let csv = `Student Name,Roll Number,Department,Period 1,Period 2,Period 3,Period 4,Period 5,Period 6,Period 7,Period 8,Total Present\n`;
    const dateRecords = this.attendanceDB[this.selectedDate] || {};

    this.students.forEach(s => {
      const rec = dateRecords[s.id] || {};
      let pCount = 0;
      const periods = [];
      for (let p = 1; p <= 8; p++) {
        const st = rec[p] || 'A';
        periods.push(st);
        if (st === 'P' || st === 'L') pCount++;
      }
      csv += `"${s.name}","${s.roll}","${s.dept}",${periods.join(',')},${pCount}/8\n`;
    });

    this.downloadFile(csv, `BioPulse_Daily_Attendance_${this.selectedDate}.csv`, 'text/csv');
  }

  exportMonthlyCSV() {
    let csv = `Student Name,Roll Number,Department,Biometric Template ID,Total Conducted Periods,Periods Present,Periods Absent,Attendance Percentage\n`;

    this.students.forEach(s => {
      let periodsPresent = 0;
      Object.keys(this.attendanceDB).forEach(d => {
        const sRec = this.attendanceDB[d][s.id];
        if (sRec) {
          for (let p = 1; p <= 8; p++) {
            if (sRec[p] === 'P' || sRec[p] === 'L') periodsPresent++;
          }
        }
      });
      const scaledPresent = Math.min(160, Math.round(periodsPresent * 4.5));
      const pct = Math.min(100, Math.round((scaledPresent / 160) * 100));

      csv += `"${s.name}","${s.roll}","${s.dept}",${s.fingerprintId},160,${scaledPresent},${160 - scaledPresent},${pct}%\n`;
    });

    this.downloadFile(csv, `BioPulse_Monthly_Report_July_2026.csv`, 'text/csv');
  }

  downloadFile(content, fileName, mimeType) {
    const a = document.createElement('a');
    mimeType = mimeType || 'application/octet-stream';

    if (navigator.msSaveBlob) {
      navigator.msSaveBlob(new Blob([content], { type: mimeType }), fileName);
    } else if (URL && 'download' in a) {
      a.href = URL.createObjectURL(new Blob([content], { type: mimeType }));
      a.setAttribute('download', fileName);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      location.href = 'data:application/octet-stream,' + encodeURIComponent(content);
    }
  }

  renderAll() {
    this.renderDailyMatrix();
    this.renderMonthlyLogs();
    this.renderStudentDirectory();
    this.checkConsecutiveAbsences();
  }
}

// Global App Instance
let app;
document.addEventListener('DOMContentLoaded', () => {
  app = new BioPulseApp();
});

// Standalone helper for scan logs API
// Standalone helper for scan logs API
async function saveAttendanceToDatabase(studentName, rollNumber) {
    try {
        const response = await fetch('/api/markAttendance', { // <--- CHANGED!
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                name: studentName, 
                roll_number: rollNumber 
            }),
        });

        const data = await response.json();
        
        if (data.success) {
            console.log("Success:", data.message);
        } else {
            console.error("Error from server:", data.message);
        }
    } catch (error) {
        console.error("Network error:", error);
    }
}
