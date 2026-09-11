/**
 * Aware AI Guardian Academy — Student progress report endpoint
 *
 * Paste this file into Extensions > Apps Script of the teacher's Google Sheet,
 * then deploy it as a Web app.  It records only student progress reports.
 */
function doGet() {
  return json_({ ok: true, service: 'Aware AI student report' });
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error('ต้องส่งข้อมูล JSON แบบ POST');
    }

    var d = JSON.parse(e.postData.contents);
    var sh = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    var headers = [
      'เลขประจำตัวนักเรียน', 'ชื่อเล่น', 'เลขที่', 'ระดับอัญมณี', 'โบนัสระดับ',
      'ดาวเดินทาง', 'ดาวบทเรียน', 'บทที่เรียนจบ',
      'คะแนน E1 ระหว่างเรียน (เต็ม 20)', 'จำนวนเหรียญหน่วย (เต็ม 5)',
      'ดาวบทที่ 1', 'คะแนนระหว่างบทที่ 1',
      'ดาวบทที่ 2', 'คะแนนระหว่างบทที่ 2',
      'ดาวบทที่ 3', 'คะแนนระหว่างบทที่ 3',
      'ดาวบทที่ 4', 'คะแนนระหว่างบทที่ 4',
      'ดาวบทที่ 5', 'คะแนนระหว่างบทที่ 5', 'ดาวพรอมต์',
      'คะแนนก่อนเรียนรวม', 'คะแนนหลังเรียนรวม', 'โบนัสภารกิจ', 'ด่านที่ผ่าน',
      'ตราสถานการณ์', 'ตราสัญลักษณ์รวม', 'ความคืบหน้า (%)', 'อัปเดตล่าสุด'
    ];

    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.setFrozenRows(1);

    var row = [
      String(d.code || ''), d.nickname || '', d.num || '', d.gem || '', d.levelBonus || '',
      d.journeyStars || 0, d.stars || 0, d.done || 0, d.unitPoints || 0, d.lessonMedals || 0,
      d.l1, d.l1post, d.l2, d.l2post, d.l3, d.l3post, d.l4, d.l4post, d.l5, d.l5post,
      d.pstars || 0, d.pretest || '', d.posttest || '', d.score || 0, d.game || 0,
      d.badges || 0, d.achievements || 0, d.pct || 0,
      d.last || new Date().toLocaleString('th-TH')
    ];

    var last = sh.getLastRow();
    var rowIndex = 0;
    if (last >= 2) {
      var codes = sh.getRange(2, 1, last - 1, 1).getValues();
      for (var i = 0; i < codes.length; i++) {
        if (String(codes[i][0]) === String(d.code || '')) {
          rowIndex = i + 2;
          break;
        }
      }
    }

    if (rowIndex) {
      sh.getRange(rowIndex, 1, 1, row.length).setValues([row]);
    } else {
      sh.appendRow(row);
      rowIndex = sh.getLastRow();
    }
    return json_({ ok: true, row: rowIndex });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

function json_(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
