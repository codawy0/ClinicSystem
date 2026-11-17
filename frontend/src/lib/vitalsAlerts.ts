import { BloodSugarType } from '../types';

export interface AlertEvaluation {
  hasAlert: boolean;
  level: 'normal' | 'warning' | 'danger';
  labelAr: string;
  detailAr?: string;
}

export interface BmiEvaluation {
  bmi: number | null;
  labelAr: string;
  level: 'normal' | 'warning' | 'danger';
  categoryKey: 'underweight' | 'normal' | 'overweight' | 'obese1' | 'obese2' | 'morbid' | 'none';
}

export const vitalsAlerts = {
  /**
   * Blood Pressure: >= 140/90 (Hypertension) or < 90/60 (Hypotension)
   */
  evaluateBp(systolic?: number | null, diastolic?: number | null): AlertEvaluation {
    if ((systolic === undefined || systolic === null || systolic === 0) &&
        (diastolic === undefined || diastolic === null || diastolic === 0)) {
      return { hasAlert: false, level: 'normal', labelAr: 'غير مسجل' };
    }

    const sys = systolic ?? 0;
    const dia = diastolic ?? 0;

    if (sys >= 140 || dia >= 90) {
      let detail = '';
      if (sys >= 140 && dia >= 90) detail = 'ارتفاع في الضغط الانقباضي والانبساطي';
      else if (sys >= 140) detail = 'ارتفاع الضغط الانقباضي (>= 140)';
      else detail = 'ارتفاع الضغط الانبساطي (>= 90)';

      return {
        hasAlert: true,
        level: 'danger',
        labelAr: 'ارتفاع ضغط الدم (Hypertension)',
        detailAr: detail,
      };
    }

    if ((sys > 0 && sys < 90) || (dia > 0 && dia < 60)) {
      let detail = '';
      if (sys > 0 && sys < 90 && dia > 0 && dia < 60) detail = 'انخفاض في الضغط الانقباضي والانبساطي';
      else if (sys > 0 && sys < 90) detail = 'انخفاض الضغط الانقباضي (< 90)';
      else detail = 'انخفاض الضغط الانبساطي (< 60)';

      return {
        hasAlert: true,
        level: 'warning',
        labelAr: 'انخفاض ضغط الدم (Hypotension)',
        detailAr: detail,
      };
    }

    return { hasAlert: false, level: 'normal', labelAr: 'ضغط دم طبيعي' };
  },

  /**
   * Pulse / Heart Rate: > 100 (Tachycardia) or < 60 (Bradycardia)
   */
  evaluatePulse(pulseBpm?: number | null): AlertEvaluation {
    if (pulseBpm === undefined || pulseBpm === null || pulseBpm === 0) {
      return { hasAlert: false, level: 'normal', labelAr: 'غير مسجل' };
    }

    if (pulseBpm > 100) {
      return {
        hasAlert: true,
        level: 'warning',
        labelAr: 'تسارع نبضات القلب (Tachycardia)',
        detailAr: `النبض مرتفع: ${pulseBpm} نبضة/دقيقة`,
      };
    }

    if (pulseBpm < 60) {
      return {
        hasAlert: true,
        level: 'warning',
        labelAr: 'تباطؤ نبضات القلب (Bradycardia)',
        detailAr: `النبض منخفض: ${pulseBpm} نبضة/دقيقة`,
      };
    }

    return { hasAlert: false, level: 'normal', labelAr: 'نبض طبيعي (60-100)' };
  },

  /**
   * Temperature: >= 38.0 C (Fever) or < 35.5 C (Hypothermia)
   */
  evaluateTemp(tempCelsius?: number | null): AlertEvaluation {
    if (tempCelsius === undefined || tempCelsius === null || tempCelsius === 0) {
      return { hasAlert: false, level: 'normal', labelAr: 'غير مسجل' };
    }

    if (tempCelsius >= 38.0) {
      return {
        hasAlert: true,
        level: 'danger',
        labelAr: 'حمى / ارتفاع حرارة (Fever)',
        detailAr: `حرارة مرتفعة: ${tempCelsius} °م`,
      };
    }

    if (tempCelsius < 35.5) {
      return {
        hasAlert: true,
        level: 'warning',
        labelAr: 'انخفاض حرارة الجسم (Hypothermia)',
        detailAr: `حرارة منخفضة: ${tempCelsius} °م`,
      };
    }

    return { hasAlert: false, level: 'normal', labelAr: 'حرارة طبيعية (36.5 - 37.5)' };
  },

  /**
   * Blood Glucose: >= 200 mg/dL (Hyperglycemia) or < 70 mg/dL (Hypoglycemia)
   */
  evaluateGlucose(sugarMgDl?: number | null, type?: BloodSugarType | null): AlertEvaluation {
    if (sugarMgDl === undefined || sugarMgDl === null || sugarMgDl === 0) {
      return { hasAlert: false, level: 'normal', labelAr: 'غير مسجل' };
    }

    const typeSuffix = type === 'Fasting' ? ' (صائم)' : type === 'PostPrandial' ? ' (بعد الأكل)' : type === 'Random' ? ' (عشوائي)' : '';

    if (sugarMgDl >= 200) {
      return {
        hasAlert: true,
        level: 'danger',
        labelAr: `ارتفاع سكر الدم (Hyperglycemia)${typeSuffix}`,
        detailAr: `القراءة: ${sugarMgDl} mg/dL`,
      };
    }

    if (sugarMgDl < 70) {
      return {
        hasAlert: true,
        level: 'danger',
        labelAr: `هبوط حاد في السكر (Hypoglycemia)${typeSuffix}`,
        detailAr: `القراءة: ${sugarMgDl} mg/dL`,
      };
    }

    return { hasAlert: false, level: 'normal', labelAr: `سكر طبيعي${typeSuffix}` };
  },

  /**
   * Oxygen Saturation (SpO2): < 94% (Hypoxia)
   */
  evaluateSpo2(spo2Pct?: number | null): AlertEvaluation {
    if (spo2Pct === undefined || spo2Pct === null || spo2Pct === 0) {
      return { hasAlert: false, level: 'normal', labelAr: 'غير مسجل' };
    }

    if (spo2Pct < 94) {
      return {
        hasAlert: true,
        level: 'danger',
        labelAr: 'نقص أكسجين الدم (Hypoxia)',
        detailAr: `نسبة التشبع: ${spo2Pct}%`,
      };
    }

    return { hasAlert: false, level: 'normal', labelAr: 'تشبع أكسجين طبيعي (>=94%)' };
  },

  /**
   * Body Mass Index (BMI): weight (kg) / (height (m))^2
   */
  calculateBmi(weightKg?: number | null, heightCm?: number | null): BmiEvaluation {
    if (!weightKg || !heightCm || weightKg <= 0 || heightCm <= 0) {
      return { bmi: null, labelAr: 'غير مكتمل', level: 'normal', categoryKey: 'none' };
    }

    const heightM = heightCm / 100;
    const rawBmi = weightKg / (heightM * heightM);
    const bmi = Math.round(rawBmi * 10) / 10;

    if (bmi < 18.5) {
      return { bmi, labelAr: 'نقص في الوزن (Underweight)', level: 'warning', categoryKey: 'underweight' };
    }
    if (bmi < 25.0) {
      return { bmi, labelAr: 'وزن طبيعي مثالي (Normal)', level: 'normal', categoryKey: 'normal' };
    }
    if (bmi < 30.0) {
      return { bmi, labelAr: 'وزن زائد (Overweight)', level: 'warning', categoryKey: 'overweight' };
    }
    if (bmi < 35.0) {
      return { bmi, labelAr: 'سمنة درجة 1 (Obese Class I)', level: 'danger', categoryKey: 'obese1' };
    }
    if (bmi < 40.0) {
      return { bmi, labelAr: 'سمنة درجة 2 (Obese Class II)', level: 'danger', categoryKey: 'obese2' };
    }
    return { bmi, labelAr: 'سمنة مفرطة خطيرة (Morbid Obesity)', level: 'danger', categoryKey: 'morbid' };
  },
};
