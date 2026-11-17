import {
  ThermalReceiptDto,
  PatientClinicalProfileDto,
  LiveQueueItemDto,
  MedicalVisitDetailDto,
  ClinicSettingDto,
  PrescriptionItemInputDto,
  ClinicalRequestInputDto,
} from '../types';
import {
  SickLeaveData,
  LabSlipData,
  PrescriptionPrintOptions,
  PrintResult,
  PrintRoleTarget,
  PrintDocType,
} from '../types/print';
import { formatEgp } from '../lib/currency';
import { api } from '../lib/api';

// Global declaration for WebView2 host bridge
declare global {
  interface Window {
    chrome?: {
      webview?: {
        postMessage: (message: any) => void;
      };
    };
  }
}

class PrintService {
  /**
   * Print Prescription with A4/A5 and Digital vs Letterhead mode
   */
  async printPrescription(
    data: {
      patient: PatientClinicalProfileDto | null;
      appointment: LiveQueueItemDto | null;
      vitals?: MedicalVisitDetailDto | null;
      diagnosis: string;
      items: PrescriptionItemInputDto[];
      clinicalRequests: ClinicalRequestInputDto[];
      nextVisitDate?: string;
      clinicSetting?: ClinicSettingDto | null;
    },
    options: PrescriptionPrintOptions = { pageSize: 'A5', mode: 'digital' }
  ): Promise<PrintResult> {
    const html = this.buildPrescriptionHtml(data, options);
    return this.routePrintJob({
      printerType: 'Prescription',
      html,
      targetRole: 'DoctorPrinter',
      options: {
        pageSize: options.pageSize || 'A5',
        orientation: 'portrait',
      },
    });
  }

  /**
   * Print 80mm Compact Thermal Receipt
   */
  async printReceipt(receipt: ThermalReceiptDto): Promise<PrintResult> {
    const html = this.buildReceiptHtml(receipt);
    return this.routePrintJob({
      printerType: 'Receipt',
      html,
      targetRole: 'ReceptionReceiptPrinter',
      options: {
        pageSize: 'Thermal80mm',
        orientation: 'portrait',
      },
    });
  }

  /**
   * Print Sick Leave Medical Certificate
   */
  async printSickLeave(data: SickLeaveData): Promise<PrintResult> {
    const html = this.buildSickLeaveHtml(data);
    return this.routePrintJob({
      printerType: 'SickLeave',
      html,
      targetRole: 'DoctorPrinter',
      options: {
        pageSize: 'A5',
        orientation: 'portrait',
      },
    });
  }

  /**
   * Print Lab / Radiology Referral Slip
   */
  async printLabSlip(data: LabSlipData): Promise<PrintResult> {
    const html = this.buildLabSlipHtml(data);
    return this.routePrintJob({
      printerType: 'LabSlip',
      html,
      targetRole: 'DoctorPrinter',
      options: {
        pageSize: 'A5',
        orientation: 'portrait',
      },
    });
  }

  /**
   * Core multi-tier router:
   * Tier 1: WebView2 desktop silent printing via IPC
   * Tier 2: LAN Print Server via POST /api/print-jobs
   * Tier 3: Isolated hidden iframe fallback
   */
  private async routePrintJob(params: {
    printerType: PrintDocType;
    html: string;
    targetRole: PrintRoleTarget;
    options: { pageSize: string; orientation: string };
  }): Promise<PrintResult> {
    // 1. Tier 1: Check WebView2 Desktop Shell
    if (typeof window !== 'undefined' && window.chrome?.webview?.postMessage) {
      try {
        window.chrome.webview.postMessage({
          action: 'silentPrint',
          printerType: params.printerType,
          html: params.html,
          options: params.options,
        });
        return { success: true, tier: 'WebView2Silent' };
      } catch (err) {
        console.warn('WebView2 silent print failed, falling back to next tier', err);
      }
    }

    // 2. Tier 2: Check if LAN Print Job server is explicitly requested via localStorage config
    const useLanPrinter =
      typeof localStorage !== 'undefined' &&
      localStorage.getItem('clinic_use_lan_print_server') === 'true';

    if (useLanPrinter) {
      try {
        const res = await api.post<{ id: number }>('/print-jobs', {
          targetRole: params.targetRole,
          documentType: params.printerType,
          htmlContent: params.html,
          payloadJson: JSON.stringify({
            type: params.printerType,
            timestamp: new Date().toISOString(),
          }),
        });
        return { success: true, tier: 'LanPrintJob', jobId: res?.id };
      } catch (err) {
        console.warn('LAN print job submission failed, falling back to iframe', err);
      }
    }

    // 3. Tier 3: Isolated Iframe Fallback
    await this.printViaIsolatedIframe(params.html);
    return { success: true, tier: 'IframeFallback' };
  }

  /**
   * Isolated Iframe Spooler
   */
  private printViaIsolatedIframe(html: string): Promise<void> {
    return new Promise((resolve) => {
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.style.visibility = 'hidden';
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document;
      if (!doc) {
        iframe.remove();
        window.print();
        resolve();
        return;
      }

      doc.open();
      doc.write(html);
      doc.close();

      iframe.contentWindow?.focus();
      setTimeout(() => {
        try {
          iframe.contentWindow?.print();
        } catch (e) {
          console.error('Iframe print error', e);
        } finally {
          setTimeout(() => {
            iframe.remove();
            resolve();
          }, 1000);
        }
      }, 300);
    });
  }

  // ==========================================
  // HTML Document Generators (Offline, Cairo font, RTL & LTR isolation)
  // ==========================================

  buildPrescriptionHtml(
    data: {
      patient: PatientClinicalProfileDto | null;
      appointment: LiveQueueItemDto | null;
      vitals?: MedicalVisitDetailDto | null;
      diagnosis: string;
      items: PrescriptionItemInputDto[];
      clinicalRequests: ClinicalRequestInputDto[];
      nextVisitDate?: string;
      clinicSetting?: ClinicSettingDto | null;
    },
    options: PrescriptionPrintOptions
  ): string {
    const isLetterhead = options.mode === 'letterhead';
    const isA4 = options.pageSize === 'A4';
    const patientName = data.patient?.fullName || data.appointment?.patientName || '---';
    const fileNumber = data.patient?.fileNumber || data.appointment?.fileNumber || '---';
    const today = new Date().toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>روشتة علاجية</title>
  <style>
    @page {
      size: ${isA4 ? 'A4 portrait' : 'A5 portrait'};
      margin: ${isLetterhead ? '45mm 10mm 10mm 10mm' : '10mm'};
    }
    body {
      font-family: 'Cairo', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      margin: 0;
      padding: 0;
      color: #0f172a;
      direction: rtl;
      font-size: ${isA4 ? '13px' : '11px'};
      line-height: 1.4;
      background: #ffffff;
    }
    .header {
      ${
        isLetterhead
          ? 'display: none;'
          : 'border-bottom: 2px solid #0284c7; padding-bottom: 8px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;'
      }
    }
    .patient-bar {
      background-color: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 6px 10px;
      margin-bottom: 14px;
      display: flex;
      justify-content: space-between;
      font-size: 11px;
    }
    .rx-symbol {
      font-size: 24px;
      font-family: serif;
      font-weight: 900;
      color: #0369a1;
      margin-bottom: 8px;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 2px;
    }
    .drug-item {
      margin-bottom: 10px;
      page-break-inside: avoid;
    }
    .drug-name {
      font-weight: bold;
      font-size: 13px;
      color: #020617;
    }
    .drug-dose {
      color: #1e293b;
      margin-right: 18px;
      font-size: 11px;
    }
    .requests-box {
      border: 1px solid #cbd5e1;
      background: #f1f5f9;
      padding: 8px 10px;
      border-radius: 6px;
      margin-top: 14px;
      page-break-inside: avoid;
    }
    .footer {
      border-top: 1px solid #cbd5e1;
      margin-top: 20px;
      padding-top: 10px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      page-break-inside: avoid;
    }
  </style>
</head>
<body>
  ${
    !isLetterhead
      ? `<div class="header">
          <div>
            <h2 style="margin: 0; font-size: 16px; color: #0369a1;">${
              data.clinicSetting?.clinicName || 'عيادة النخبة التخصصية'
            }</h2>
            <div style="font-weight: bold; color: #0c4a6e;">${
              data.clinicSetting?.doctorName || 'د. طبيب العيادة'
            }</div>
            <div style="font-size: 10px; color: #64748b;">${
              data.clinicSetting?.doctorTitle || 'استشاري الباطنة'
            }</div>
          </div>
          <div style="text-align: left; font-size: 10px; color: #64748b;">
            <div>التاريخ: ${today}</div>
            <div>الملف: <bdi dir="ltr">#${fileNumber}</bdi></div>
          </div>
        </div>`
      : ''
  }

  <div class="patient-bar">
    <div><strong>اسم المريض:</strong> ${patientName}</div>
    ${
      data.patient?.ageYears
        ? `<div><strong>السن:</strong> ${data.patient.ageYears} سنة</div>`
        : ''
    }
    <div><strong>التاريخ:</strong> ${today}</div>
    <div><strong>رقم الملف:</strong> <bdi dir="ltr">#${fileNumber}</bdi></div>
  </div>

  ${
    data.diagnosis
      ? `<div style="margin-bottom: 10px; font-size: 11px;"><strong>التشخيص:</strong> ${data.diagnosis}</div>`
      : ''
  }

  <div class="rx-symbol">℞</div>

  <div class="medications">
    ${data.items
      .map(
        (item, idx) => `
      <div class="drug-item">
        <div class="drug-name">
          ${idx + 1}. <bdi dir="ltr">${item.drugName}</bdi>
          ${
            item.strength
              ? `<bdi dir="ltr" style="font-size: 11px; margin-right: 4px;">${item.strength}</bdi>`
              : ''
          }
          ${
            item.form
              ? `<span style="font-size: 10px; color: #64748b;">(${item.form})</span>`
              : ''
          }
        </div>
        <div class="drug-dose">
          <span>${item.dosage}</span> — <span>${item.timing}</span>
          ${item.duration ? `— لمدة ${item.duration}` : ''}
        </div>
        ${
          item.instructions
            ? `<div style="font-size: 10px; color: #64748b; margin-right: 18px;">* ${item.instructions}</div>`
            : ''
        }
      </div>
    `
      )
      .join('')}
  </div>

  ${
    data.clinicalRequests.length > 0
      ? `<div class="requests-box">
          <div style="font-weight: bold; color: #1e1b4b; font-size: 11px; margin-bottom: 4px;">الفحوصات والتحاليل المطلوبة:</div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: 10px;">
            ${data.clinicalRequests
              .map(
                (req) => `
              <div>• ${req.nameAr} ${
                  req.nameEn ? `<bdi dir="ltr">(${req.nameEn})</bdi>` : ''
                }</div>
            `
              )
              .join('')}
          </div>
        </div>`
      : ''
  }

  <div class="footer">
    <div>
      ${
        data.nextVisitDate
          ? `<div><strong>موعد الاستشارة القادمة:</strong> ${data.nextVisitDate}</div>`
          : ''
      }
    </div>
    <div style="text-align: center; min-width: 140px;">
      <div style="font-weight: bold; font-size: 11px;">توقيع الطبيب</div>
      <div style="height: 35px; border-bottom: 1px dashed #94a3b8;"></div>
      <div style="font-size: 10px; color: #64748b; margin-top: 4px;">${
        data.clinicSetting?.doctorName || ''
      }</div>
    </div>
  </div>
</body>
</html>`;
  }

  buildReceiptHtml(receipt: ThermalReceiptDto): string {
    return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>إيصال سداد</title>
  <style>
    @page {
      size: 80mm auto;
      margin: 0;
    }
    body {
      font-family: 'Cairo', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      width: 72mm;
      max-width: 80mm;
      margin: 0 auto;
      padding: 3mm;
      direction: rtl;
      font-size: 11px;
      line-height: 1.3;
      color: #000000;
      background: #ffffff;
    }
    .center { text-align: center; }
    .border-b { border-bottom: 1px dashed #000; padding-bottom: 4px; margin-bottom: 4px; }
    .queue-box {
      border: 2px solid #000;
      border-radius: 4px;
      padding: 4px;
      margin: 6px 0;
      text-align: center;
    }
    .queue-num {
      font-size: 26px;
      font-weight: 900;
      line-height: 1;
    }
    .row { display: flex; justify-content: space-between; margin-bottom: 2px; }
    .bold { font-weight: bold; }
  </style>
</head>
<body>
  <div class="center border-b">
    <div class="bold" style="font-size: 13px;">${receipt.clinicName || 'العيادة التخصصية'}</div>
    <div>${receipt.doctorName}</div>
    <div style="font-size: 9px;">${receipt.specialty}</div>
  </div>

  ${
    receipt.queueNumber !== null && receipt.queueNumber !== undefined
      ? `<div class="queue-box">
          <div style="font-size: 9px; font-weight: bold;">رقم الدور في الانتظار</div>
          <div class="queue-num">${receipt.queueNumber}</div>
        </div>`
      : ''
  }

  <div class="border-b">
    <div class="row"><span>رقم الإيصال:</span><span class="bold"><bdi dir="ltr">${receipt.receiptNumber}</bdi></span></div>
    <div class="row"><span>التاريخ:</span><span>${receipt.date}</span></div>
    <div class="row"><span>اسم المريض:</span><span class="bold">${receipt.patientName}</span></div>
    <div class="row"><span>رقم الملف:</span><span><bdi dir="ltr">#${receipt.fileNumber}</bdi></span></div>
  </div>

  <div class="border-b">
    <div class="row"><span class="bold">الخدمة:</span><span class="bold">${receipt.serviceName}</span></div>
    ${(receipt.procedures || [])
      .map((p) => `<div style="font-size: 9px; padding-right: 8px;">• ${p}</div>`)
      .join('')}
  </div>

  <div class="border-b">
    <div class="row"><span>الإجمالي:</span><span>${formatEgp(receipt.totalPiastres)}</span></div>
    ${
      receipt.discountPiastres > 0
        ? `<div class="row"><span>الخصم:</span><span>-${formatEgp(receipt.discountPiastres)}</span></div>`
        : ''
    }
    <div class="row bold"><span>الصافي المطلوب:</span><span>${formatEgp(receipt.netTotalPiastres)}</span></div>
    <div class="row bold"><span>المدفوع:</span><span>${formatEgp(receipt.paidPiastres)}</span></div>
    ${
      receipt.remainingPiastres > 0
        ? `<div class="row bold"><span>المتبقي:</span><span>${formatEgp(receipt.remainingPiastres)}</span></div>`
        : `<div class="center bold" style="margin-top: 3px;">خالص تماماً ✅</div>`
    }
    <div class="row" style="font-size: 9px; margin-top: 3px;"><span>طريقة الدفع:</span><span>${receipt.paymentMethod}</span></div>
  </div>

  <div class="center" style="font-size: 9px; margin-top: 6px;">
    <div>الموظف: ${receipt.receptionistName}</div>
    <div style="margin-top: 2px;">نتمنى لكم دوام الصحة والعافية</div>
  </div>
</body>
</html>`;
  }

  buildSickLeaveHtml(data: SickLeaveData): string {
    return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>تقرير إجازة مرضية</title>
  <style>
    @page { size: A5 portrait; margin: 12mm; }
    body {
      font-family: 'Cairo', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      margin: 0; padding: 0; direction: rtl; font-size: 11px; line-height: 1.6; color: #0f172a;
      background: #ffffff;
    }
    .header { text-align: center; border-bottom: 2px solid #0369a1; padding-bottom: 8px; margin-bottom: 14px; }
    .badge {
      display: inline-block; background: #e0f2fe; color: #0369a1; font-weight: bold;
      padding: 3px 12px; border-radius: 9999px; margin-top: 6px; font-size: 13px;
    }
    .content-box {
      border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; background: #f8fafc; margin-bottom: 14px;
    }
    .leave-box {
      border: 2px solid #0284c7; background: #eff6ff; border-radius: 8px; padding: 10px;
      text-align: center; margin: 12px 0;
    }
    .leave-days { font-size: 22px; font-weight: 900; color: #0369a1; }
    .footer {
      display: flex; justify-content: space-between; align-items: flex-end; margin-top: 24px;
    }
    .stamp-box {
      width: 110px; height: 70px; border: 1px dashed #94a3b8; border-radius: 6px;
      display: flex; align-items: center; justify-content: center; font-size: 9px; color: #94a3b8;
    }
  </style>
</head>
<body>
  <div class="header">
    <h2 style="margin: 0; color: #0369a1; font-size: 16px;">${data.clinicName}</h2>
    <div>${data.doctorName} — ${data.doctorTitle}</div>
    <div class="badge">شهادة طبية / تقرير إجازة مرضية</div>
  </div>

  <div class="content-box">
    <p>
      يفيد الطبيب المعالج بأن المريض / <strong>${data.patientName}</strong>،
      المقيد بالملف الطبي رقم <strong><bdi dir="ltr">#${data.fileNumber}</bdi></strong>،
      قد قام بمراجعة العيادة بتاريخ <strong>${data.issueDate}</strong>.
    </p>
    <p>
      وبعد الكشف الطبي السريري والفحوصات، تبين أنه يعاني من: <strong>${data.diagnosis}</strong>.
    </p>
  </div>

  <div class="leave-box">
    <div>يوصى بمنح المريض راحة تامة وإجازة مرضية عن العمل لمدة:</div>
    <div class="leave-days">${data.leaveDays} أيام</div>
    <div>تبدأ من تاريخ <strong>${data.startDate}</strong> وحتى تاريخ <strong>${data.endDate}</strong></div>
    <div style="font-size: 10px; color: #475569; margin-top: 4px;">تاريخ العودة للعمل المفترض: <strong>${data.returnToWorkDate}</strong></div>
  </div>

  ${
    data.notes
      ? `<div style="font-size: 10px; color: #475569; margin-bottom: 12px;"><strong>ملاحظات وتوصيات:</strong> ${data.notes}</div>`
      : ''
  }

  <div style="font-size: 9px; color: #64748b; margin-top: 10px;">
    * هذه الشهادة معتمدة من الطبيب المعالج ومخصصة لجهة العمل. أي شطب أو كشط في البيانات يعتبر لاغياً للشهادة.
  </div>

  <div class="footer">
    <div>
      <div style="font-size: 10px;">تاريخ التحرير: ${data.issueDate}</div>
    </div>
    <div class="stamp-box">خاتم العيادة</div>
    <div style="text-align: center; min-width: 120px;">
      <div style="font-weight: bold;">توقيع الطبيب المعالج</div>
      <div style="height: 35px; border-bottom: 1px dashed #94a3b8;"></div>
      <div style="font-size: 9px; color: #64748b; margin-top: 3px;">${data.doctorName}</div>
    </div>
  </div>
</body>
</html>`;
  }

  buildLabSlipHtml(data: LabSlipData): string {
    return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>طلب فحوصات وتحاليل</title>
  <style>
    @page { size: A5 portrait; margin: 10mm; }
    body {
      font-family: 'Cairo', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      margin: 0; padding: 0; direction: rtl; font-size: 11px; color: #0f172a; line-height: 1.4;
      background: #ffffff;
    }
    .header { border-bottom: 2px solid #4f46e5; padding-bottom: 6px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; }
    .patient-bar { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 10px; margin-bottom: 12px; display: flex; justify-content: space-between; font-size: 10px; }
    .req-table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    .req-table th, .req-table td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: right; }
    .req-table th { background: #f1f5f9; font-weight: bold; font-size: 10px; }
    .checkbox { width: 14px; height: 14px; border: 1.5px solid #475569; display: inline-block; border-radius: 2px; }
    .footer { border-top: 1px solid #cbd5e1; margin-top: 18px; padding-top: 8px; display: flex; justify-content: space-between; align-items: flex-end; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h3 style="margin: 0; color: #4338ca; font-size: 14px;">${data.clinicName}</h3>
      <div style="font-size: 11px; font-weight: bold;">${data.doctorName}</div>
      <div style="font-size: 9px; color: #64748b;">${data.doctorTitle}</div>
    </div>
    <div style="text-align: left; font-size: 10px; color: #64748b;">
      <div style="font-weight: bold; color: #4338ca;">طلب تحاليل وفحوصات طبية</div>
      <div>التاريخ: ${data.date}</div>
    </div>
  </div>

  <div class="patient-bar">
    <div><strong>اسم المريض:</strong> ${data.patientName}</div>
    <div><strong>الملف:</strong> <bdi dir="ltr">#${data.fileNumber}</bdi></div>
    ${data.ageYears ? `<div><strong>السن:</strong> ${data.ageYears} سنة</div>` : ''}
  </div>

  ${
    data.provisionalDiagnosis
      ? `<div style="font-size: 10px; margin-bottom: 8px;"><strong>التشخيص المبدئي (Clinical Indication):</strong> ${data.provisionalDiagnosis}</div>`
      : ''
  }

  <table class="req-table">
    <thead>
      <tr>
        <th style="width: 25px; text-align: center;">#</th>
        <th style="width: 30px; text-align: center;">تم</th>
        <th style="width: 60px;">النوع</th>
        <th>اسم الفحص المطلوب</th>
        <th>ملاحظات الطبيب</th>
      </tr>
    </thead>
    <tbody>
      ${data.requests
        .map(
          (req, idx) => `
        <tr>
          <td style="text-align: center; font-weight: bold; color: #64748b;">${idx + 1}</td>
          <td style="text-align: center;"><span class="checkbox"></span></td>
          <td style="font-weight: bold; color: ${
            req.requestType === 'Lab' ? '#059669' : '#7c3aed'
          }; font-size: 10px;">
            ${req.requestType === 'Lab' ? 'تحليل دم' : 'أشعة'}
          </td>
          <td>
            <div style="font-weight: bold;">${req.nameAr}</div>
            ${
              req.nameEn
                ? `<div style="font-size: 10px; color: #64748b;"><bdi dir="ltr">${req.nameEn}</bdi></div>`
                : ''
            }
          </td>
          <td style="font-size: 10px; color: #475569;">${req.notes || '---'}</td>
        </tr>
      `
        )
        .join('')}
    </tbody>
  </table>

  ${
    data.clinicalNotes
      ? `<div style="margin-top: 10px; font-size: 10px; color: #475569;"><strong>تعليمات خاصة للمعمل:</strong> ${data.clinicalNotes}</div>`
      : ''
  }

  <div class="footer">
    <div style="font-size: 9px; color: #64748b;">يرجى موافاة المريض بالنتائج في أقرب وقت لإعادة المتابعة.</div>
    <div style="text-align: center; min-width: 120px;">
      <div style="font-weight: bold; font-size: 10px;">توقيع الطبيب</div>
      <div style="height: 30px; border-bottom: 1px dashed #94a3b8;"></div>
      <div style="font-size: 9px; color: #64748b; margin-top: 3px;">${data.doctorName}</div>
    </div>
  </div>
</body>
</html>`;
  }
}

export const printService = new PrintService();
