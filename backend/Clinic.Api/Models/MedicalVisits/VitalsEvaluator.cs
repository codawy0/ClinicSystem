namespace Clinic.Api.Models.MedicalVisits;

public static class VitalsEvaluator
{
    public static decimal? CalculateBmi(decimal? weightKg, decimal? heightCm)
    {
        if (weightKg.HasValue && heightCm.HasValue && heightCm.Value > 0)
        {
            decimal heightMeters = heightCm.Value / 100m;
            return Math.Round(weightKg.Value / (heightMeters * heightMeters), 2);
        }
        return null;
    }

    public static string? GetBmiCategory(decimal? bmi)
    {
        if (!bmi.HasValue) return null;
        if (bmi.Value < 18.5m) return "نقص في الوزن";
        if (bmi.Value < 25.0m) return "وزن طبيعي";
        if (bmi.Value < 30.0m) return "زيادة في الوزن";
        return "سمنة";
    }

    public static VitalAlertsSummaryDto Evaluate(
        int? bpSystolic,
        int? bpDiastolic,
        int? pulseBpm,
        decimal? tempCelsius,
        int? bloodSugarMgDl,
        int? spo2Pct,
        decimal? bmi)
    {
        var alerts = new VitalAlertsSummaryDto();

        // BP High: Systolic >= 140 or Diastolic >= 90
        if ((bpSystolic.HasValue && bpSystolic.Value >= 140) || (bpDiastolic.HasValue && bpDiastolic.Value >= 90))
        {
            alerts.IsBpHigh = true;
            bool isCritical = (bpSystolic.HasValue && bpSystolic.Value >= 180) || (bpDiastolic.HasValue && bpDiastolic.Value >= 120);
            alerts.Items.Add(new VitalAlertDto
            {
                Parameter = "Bp",
                Severity = isCritical ? "Critical" : "Warning",
                MessageAr = isCritical ? "ارتفاع حاد وخطير في ضغط الدم - أزمة فرط ضغط الدم" : "ارتفاع في ضغط الدم",
                Value = $"{bpSystolic}/{bpDiastolic}"
            });
        }

        // BP Low: Systolic < 90 or Diastolic < 60
        if ((bpSystolic.HasValue && bpSystolic.Value < 90) || (bpDiastolic.HasValue && bpDiastolic.Value < 60))
        {
            alerts.IsBpLow = true;
            alerts.Items.Add(new VitalAlertDto
            {
                Parameter = "Bp",
                Severity = "Warning",
                MessageAr = "انخفاض في ضغط الدم",
                Value = $"{bpSystolic}/{bpDiastolic}"
            });
        }

        // Pulse High: Pulse > 100
        if (pulseBpm.HasValue && pulseBpm.Value > 100)
        {
            alerts.IsPulseHigh = true;
            bool isCritical = pulseBpm.Value > 120;
            alerts.Items.Add(new VitalAlertDto
            {
                Parameter = "Pulse",
                Severity = isCritical ? "Critical" : "Warning",
                MessageAr = isCritical ? "تسارع حاد في نبضات القلب" : "تسارع في نبضات القلب",
                Value = pulseBpm.Value.ToString()
            });
        }

        // Pulse Low: Pulse < 60
        if (pulseBpm.HasValue && pulseBpm.Value < 60)
        {
            alerts.IsPulseLow = true;
            bool isCritical = pulseBpm.Value < 50;
            alerts.Items.Add(new VitalAlertDto
            {
                Parameter = "Pulse",
                Severity = isCritical ? "Critical" : "Warning",
                MessageAr = isCritical ? "تباطؤ حاد في نبضات القلب" : "تباطؤ في نبضات القلب",
                Value = pulseBpm.Value.ToString()
            });
        }

        // Temp High: Temp >= 38.0
        if (tempCelsius.HasValue && tempCelsius.Value >= 38.0m)
        {
            alerts.IsTempHigh = true;
            bool isCritical = tempCelsius.Value >= 39.5m;
            alerts.Items.Add(new VitalAlertDto
            {
                Parameter = "Temp",
                Severity = isCritical ? "Critical" : "Warning",
                MessageAr = isCritical ? "ارتفاع شديد في درجة الحرارة (حمى عالية)" : "ارتفاع في درجة الحرارة (حمى)",
                Value = $"{tempCelsius.Value}°C"
            });
        }

        // Temp Low: Temp < 35.5
        if (tempCelsius.HasValue && tempCelsius.Value < 35.5m)
        {
            alerts.IsTempLow = true;
            alerts.Items.Add(new VitalAlertDto
            {
                Parameter = "Temp",
                Severity = "Warning",
                MessageAr = "انخفاض في درجة حرارة الجسم",
                Value = $"{tempCelsius.Value}°C"
            });
        }

        // Glucose High: BloodSugar >= 200
        if (bloodSugarMgDl.HasValue && bloodSugarMgDl.Value >= 200)
        {
            alerts.IsGlucoseHigh = true;
            bool isCritical = bloodSugarMgDl.Value >= 300;
            alerts.Items.Add(new VitalAlertDto
            {
                Parameter = "BloodSugar",
                Severity = isCritical ? "Critical" : "Warning",
                MessageAr = isCritical ? "ارتفاع حاد في سكر الدم" : "ارتفاع في سكر الدم",
                Value = $"{bloodSugarMgDl.Value} mg/dL"
            });
        }

        // Glucose Low: BloodSugar < 70
        if (bloodSugarMgDl.HasValue && bloodSugarMgDl.Value < 70)
        {
            alerts.IsGlucoseLow = true;
            bool isCritical = bloodSugarMgDl.Value < 50;
            alerts.Items.Add(new VitalAlertDto
            {
                Parameter = "BloodSugar",
                Severity = isCritical ? "Critical" : "Warning",
                MessageAr = isCritical ? "هبوط حاد وخطير في سكر الدم" : "انخفاض في سكر الدم",
                Value = $"{bloodSugarMgDl.Value} mg/dL"
            });
        }

        // SpO2 Low: Spo2 < 94
        if (spo2Pct.HasValue && spo2Pct.Value < 94)
        {
            alerts.IsSpo2Low = true;
            bool isCritical = spo2Pct.Value < 90;
            alerts.Items.Add(new VitalAlertDto
            {
                Parameter = "Spo2",
                Severity = isCritical ? "Critical" : "Warning",
                MessageAr = isCritical ? "نقص حاد في نسبة الأكسجين بالدم" : "انخفاض في نسبة الأكسجين بالدم",
                Value = $"{spo2Pct.Value}%"
            });
        }

        // BMI alerts
        if (bmi.HasValue)
        {
            if (bmi.Value < 18.5m)
            {
                alerts.Items.Add(new VitalAlertDto
                {
                    Parameter = "Bmi",
                    Severity = "Info",
                    MessageAr = "نقص في الوزن",
                    Value = bmi.Value.ToString("F1")
                });
            }
            else if (bmi.Value >= 25.0m && bmi.Value < 30.0m)
            {
                alerts.Items.Add(new VitalAlertDto
                {
                    Parameter = "Bmi",
                    Severity = "Warning",
                    MessageAr = "زيادة في الوزن",
                    Value = bmi.Value.ToString("F1")
                });
            }
            else if (bmi.Value >= 30.0m)
            {
                alerts.Items.Add(new VitalAlertDto
                {
                    Parameter = "Bmi",
                    Severity = "Warning",
                    MessageAr = "سمنة",
                    Value = bmi.Value.ToString("F1")
                });
            }
        }

        return alerts;
    }
}
